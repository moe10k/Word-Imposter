import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import type { GameState } from './src/types.ts';
import { checkWinCondition, nextTurn, resolveVoting } from './server/gameFlow.ts';
import { registerSocketHandlers } from './server/registerSocketHandlers.ts';
import { createPlayerStateView } from './server/stateView.ts';

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
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

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
