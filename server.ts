import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import type { GameState } from './src/types.ts';
import { registerAuthRoutes } from './server/auth/http.ts';
import { getSessionSecret, getSessionTtlMs } from './server/auth/session.ts';
import { getSessionUserFromCookieHeader } from './server/auth/service.ts';
import { createMySqlAuthStore } from './server/auth/store.ts';
import { closeDbPool, getDatabaseConfig, getDatabaseSourceName, getDbPool } from './server/db.ts';
import { checkWinCondition, nextTurn, resolveVoting } from './server/gameFlow.ts';
import { registerSocketHandlers } from './server/registerSocketHandlers.ts';
import { createPlayerStateView } from './server/stateView.ts';

function getAppUrl() {
  const appUrl = process.env.APP_URL?.trim();
  if (!appUrl) {
    throw new Error('APP_URL is not set. Add it to your environment before starting the server.');
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(appUrl);
  } catch {
    throw new Error('APP_URL must be a valid absolute URL.');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('APP_URL must use the http:// or https:// protocol.');
  }

  return parsedUrl;
}

function validateStartupConfig(nodeEnv: string) {
  getDatabaseConfig();
  getSessionSecret();
  getSessionTtlMs();

  if (nodeEnv === 'production') {
    getAppUrl();
  }
}

function getFirstHeaderValue(header: string | string[] | undefined) {
  if (Array.isArray(header)) {
    return header[0];
  }
  return header;
}

function isAllowedSocketOrigin(origin: string | undefined, appUrl: URL | null, requestHost: string | undefined) {
  if (!origin) {
    return true;
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  const allowedHosts = new Set<string>();
  if (appUrl) {
    allowedHosts.add(appUrl.host.toLowerCase());
  }
  if (requestHost) {
    allowedHosts.add(requestHost.toLowerCase());
  }

  return allowedHosts.has(originUrl.host.toLowerCase());
}

async function startServer() {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  validateStartupConfig(nodeEnv);

  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());

  const appUrl = process.env.APP_URL?.trim() ? getAppUrl() : null;
  const authStore = createMySqlAuthStore(getDbPool());
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: true,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    allowRequest: (request, callback) => {
      if (nodeEnv !== 'production') {
        callback(null, true);
        return;
      }

      const forwardedHost = getFirstHeaderValue(request.headers['x-forwarded-host']);
      const directHost = getFirstHeaderValue(request.headers.host);
      const requestHost = forwardedHost ?? directHost;
      const allowed = isAllowedSocketOrigin(request.headers.origin, appUrl, requestHost);
      callback(null, allowed);
    },
  });

  const PORT = Number(process.env.PORT) || 3000;
  const EVENT_COOLDOWNS_MS = {
    requestStartGame: Number(process.env.START_GAME_COOLDOWN_MS ?? 5000),
    submitImposterGuess: Number(process.env.IMPOSTER_GUESS_COOLDOWN_MS ?? 3000)
  } as const;
  type RateLimitedEvent = keyof typeof EVENT_COOLDOWNS_MS;
  const rateLimitTracker = new Map<string, Partial<Record<RateLimitedEvent, number>>>();

  const checkRateLimit = (socketId: string, event: RateLimitedEvent) => {
    const now = Date.now();
    const cooldown = EVENT_COOLDOWNS_MS[event];
    if (!cooldown) return 0;
    const entry = rateLimitTracker.get(socketId) ?? {};
    const lastCall = entry[event] ?? 0;
    const elapsed = now - lastCall;
    if (elapsed < cooldown) {
      return cooldown - elapsed;
    }
    entry[event] = now;
    rateLimitTracker.set(socketId, entry);
    return 0;
  };

  const rooms: Record<string, GameState> = {};
  let isShuttingDown = false;

  console.log(`Database config source: ${getDatabaseSourceName()}`);

  app.get('/healthz', async (_request, response) => {
    if (isShuttingDown) {
      response.status(503).json({ status: 'shutting_down' });
      return;
    }

    try {
      await getDbPool().query('SELECT 1');
      response.json({ status: 'ok' });
    } catch (error) {
      response.status(503).json({
        status: 'degraded',
        error: error instanceof Error ? error.message : 'Database health check failed.',
      });
    }
  });

  registerAuthRoutes(app, authStore);

  io.use(async (socket, next) => {
    try {
      socket.data.authUser = await getSessionUserFromCookieHeader(authStore, socket.handshake.headers.cookie);
      next();
    } catch (error) {
      next(error as Error);
    }
  });

  const broadcastState = (roomId: string) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players.forEach(player => {
      io.to(player.id).emit('stateUpdate', createPlayerStateView(room, player));
    });
  };

  const timers: Record<string, NodeJS.Timeout> = {};
  const clearTimer = (roomId: string) => {
    if (timers[roomId]) {
      clearInterval(timers[roomId]);
      delete timers[roomId];
    }
  };
  const clearRoundTimer = (roomId: string) => {
    if (timers[roomId]) {
      clearInterval(timers[roomId]);
      delete timers[roomId];
    }
  };

  const startTimer = (roomId: string, seconds: number, onComplete: () => void) => {
    clearTimer(roomId);
    const room = rooms[roomId];
    if (!room) return;

    room.timer = seconds;
    room.maxTimer = seconds;

    timers[roomId] = setInterval(() => {
      room.timer--;
      if (room.timer <= 0) {
        clearInterval(timers[roomId]);
        delete timers[roomId];
        onComplete();
      }
      broadcastState(roomId);
    }, 1000);
    broadcastState(roomId);
  };

  const runNextTurn = (roomId: string) => {
    nextTurn(roomId, rooms, {
      broadcastState,
      startTimer,
      clearRoundTimer,
      nextTurn: runNextTurn,
    });
  };

  const runCheckWinCondition = (roomId: string) => {
    checkWinCondition(roomId, rooms, {
      broadcastState,
      clearTimer,
      nextTurn: runNextTurn,
    });
  };

  const runResolveVoting = (roomId: string) => {
    resolveVoting(roomId, rooms, {
      broadcastState,
      checkWinCondition: runCheckWinCondition,
    });
  };

  registerSocketHandlers({
    io,
    rooms,
    rateLimitTracker,
    checkRateLimit,
    broadcastState,
    startTimer,
    clearTimer,
    runNextTurn,
    runResolveVoting,
  });

  let vite: { close(): Promise<void> } | null = null;
  if (nodeEnv !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const viteServer = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    vite = viteServer;
    app.use(viteServer.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const clearAllTimers = () => {
    Object.keys(timers).forEach(clearTimer);
  };

  const shutdown = async (signal: string) => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`Received ${signal}. Shutting down gracefully.`);
    clearAllTimers();

    try {
      await vite?.close();
      await new Promise<void>((resolve, reject) => {
        io.close(error => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
      await closeDbPool();
    } catch (error) {
      console.error('Graceful shutdown failed:', error);
      process.exitCode = 1;
    } finally {
      process.exit();
    }
  };

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  httpServer.listen(PORT, '0.0.0.0', () => {
    const address = httpServer.address();
    const resolvedPort =
      typeof address === 'object' && address ? address.port : PORT;
    console.log(`Server running on http://127.0.0.1:${resolvedPort}`);
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exitCode = 1;
});
