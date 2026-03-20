import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { createServer as createViteServer } from "vite";
import type { GameState, Player } from "./src/types.ts";

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  const PORT = Number(process.env.PORT) || 3000;

  // Security: Simple HTML escape
  const escapeHtml = (unsafe: string) => {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  // Game state storage
  const rooms: Record<string, GameState> = {};

  // Broadcast state to all players in a room, filtering sensitive info
  const broadcastState = (roomId: string) => {
    const room = rooms[roomId];
    if (!room) return;

    room.players.forEach(player => {
      const filteredState = { ...room };

      // Filter words based on phase and role
      if (room.phase === 'playing' || room.phase === 'voting') {
        if (player.role === 'imposter') {
          filteredState.secretWord = ''; // Hide secret word from imposter
          // imposterWord is already correct
        } else if (player.role === 'player') {
          filteredState.imposterWord = ''; // Hide imposter word from players
          // secretWord is already correct
        } else {
          // Spectators see nothing
          filteredState.secretWord = '';
          filteredState.imposterWord = '';
        }
      } else if (room.phase === 'lobby') {
        filteredState.secretWord = '';
        filteredState.imposterWord = '';
      }
      // In 'gameOver', everyone sees everything

      io.to(player.id).emit('stateUpdate', filteredState);
    });
  };

  const getInitialState = (roomId: string): GameState => ({
    roomId,
    phase: 'lobby',
    players: [],
    messages: [],
    secretWord: '',
    imposterWord: '',
    currentTurnPlayerId: null,
    turnOrder: [],
    round: 1,
    winner: null,
    eliminatedPlayerId: null,
    lastVoteResults: {},
    timer: 0,
    maxTimer: 0,
  });

  const timers: Record<string, NodeJS.Timeout> = {};

  const startTimer = (roomId: string, seconds: number, onComplete: () => void) => {
    if (timers[roomId]) clearInterval(timers[roomId]);
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

  const nextTurn = (roomId: string) => {
    const room = rooms[roomId];
    if (!room) return;

    const activePlayers = room.players.filter(p => !p.isEliminated && p.role !== 'spectator');
    if (activePlayers.length === 0) return;

    // Filter turn order to only include active players
    const activeTurnOrder = room.turnOrder.filter(id =>
      activePlayers.some(p => p.id === id)
    );

    if (activeTurnOrder.length === 0) return;

    const currentIndex = activeTurnOrder.indexOf(room.currentTurnPlayerId || '');
    const nextIndex = (currentIndex + 1) % activeTurnOrder.length;

    if (nextIndex === 0 && currentIndex !== -1) {
      // End of round, go to voting
      room.phase = 'voting';
      room.messages.push({
        id: Math.random().toString(36).substring(7),
        playerId: 'system',
        playerName: 'System',
        text: 'Round finished! Time to vote.',
        timestamp: Date.now(),
        isSystem: true
      });
      startTimer(roomId, 30, () => {
        resolveVoting(roomId);
      });
    } else {
      room.currentTurnPlayerId = activeTurnOrder[nextIndex];
      startTimer(roomId, 45, () => {
        // Auto-skip or give random hint? Let's just go to next turn
        const currentPlayer = room.players.find(p => p.id === room.currentTurnPlayerId);
        if (currentPlayer) {
          room.messages.push({
            id: Math.random().toString(36).substring(7),
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            text: 'No Guess Made',
            timestamp: Date.now(),
            isWarning: true
          });
          currentPlayer.hints.push('No Guess Made');
        }
        nextTurn(roomId);
      });
    }
    broadcastState(roomId);
  };

  const resolveVoting = (roomId: string) => {
    const room = rooms[roomId];
    if (!room) return;

    const votes = room.lastVoteResults;
    const voteCounts: Record<string, number> = {};
    Object.values(votes).forEach(id => {
      voteCounts[id] = (voteCounts[id] || 0) + 1;
    });

    let maxVotes = -1;
    let eliminatedId = '';
    Object.entries(voteCounts).forEach(([id, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        eliminatedId = id;
      }
    });

    if (eliminatedId) {
      room.eliminatedPlayerId = eliminatedId;
      const p = room.players.find(pl => pl.id === eliminatedId);
      if (p) {
        p.isEliminated = true;
        room.messages.push({
          id: Math.random().toString(36).substring(7),
          playerId: 'system',
          playerName: 'System',
          text: `${p.name} was voted out!`,
          timestamp: Date.now(),
          isSystem: true
        });
      }
      checkWinCondition(roomId);
    } else {
      // No one voted?
      room.messages.push({
        id: Math.random().toString(36).substring(7),
        playerId: 'system',
        playerName: 'System',
        text: `No one was voted out this round.`,
        timestamp: Date.now(),
        isSystem: true
      });
      checkWinCondition(roomId);
    }
    broadcastState(roomId);
  };

  const checkWinCondition = (roomId: string) => {
    const room = rooms[roomId];
    if (!room) return;

    const eliminatedPlayer = room.players.find(p => p.id === room.eliminatedPlayerId);
    const activePlayers = room.players.filter(p => !p.isEliminated && p.role !== 'spectator');
    const imposter = room.players.find(p => p.role === 'imposter');

    if (eliminatedPlayer?.role === 'imposter') {
      room.phase = 'gameOver';
      room.winner = 'players';
      if (timers[roomId]) clearInterval(timers[roomId]);
    } else if (activePlayers.length <= 2) {
      room.phase = 'gameOver';
      room.winner = 'imposter';
      if (timers[roomId]) clearInterval(timers[roomId]);
    } else {
      room.phase = 'playing';
      room.round++;
      room.lastVoteResults = {};
      room.eliminatedPlayerId = null;
      room.currentTurnPlayerId = null;
      nextTurn(roomId);
    }
    broadcastState(roomId);
  };

  io.on('connection', (socket) => {
    socket.on('joinRoom', ({ roomId, playerName }) => {
      // Input validation
      if (typeof roomId !== 'string' || !/^[a-z0-9]{1,20}$/i.test(roomId)) return;
      if (typeof playerName !== 'string' || !playerName.trim() || playerName.length > 20) {
        socket.emit('joinError', 'Invalid name. Max 20 characters.');
        return;
      }

      const sanitizedName = escapeHtml(playerName.trim());

      if (!rooms[roomId]) {
        rooms[roomId] = getInitialState(roomId);
      }
      const room = rooms[roomId];

      const existingPlayer = room.players.find(p => p.name === sanitizedName);
      if (existingPlayer && existingPlayer.isConnected) {
        socket.emit('joinError', 'Username already taken in this room.');
        return;
      }

      socket.join(roomId);
      if (existingPlayer) {
        existingPlayer.id = socket.id;
        existingPlayer.isConnected = true;
      } else {
        room.players.push({
          id: socket.id,
          name: sanitizedName,
          role: room.phase === 'lobby' ? 'player' : 'spectator',
          isEliminated: false,
          isHost: room.players.length === 0,
          hints: [],
          isReady: false,
          isConnected: true,
        });
      }
      broadcastState(roomId);
    });

    socket.on('chatMessage', ({ roomId, text }) => {
      const room = rooms[roomId];
      if (!room) return;

      // Input validation
      if (typeof text !== 'string' || !text.trim() || text.length > 200) return;

      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        const sanitizedText = escapeHtml(text.trim());
        room.messages.push({
          id: Math.random().toString(36).substring(7),
          playerId: player.id,
          playerName: player.name,
          text: sanitizedText,
          timestamp: Date.now()
        });

        // Keep message history manageable
        if (room.messages.length > 100) {
          room.messages.shift();
        }

        broadcastState(roomId);
      }
    });

    socket.on('kickPlayer', ({ roomId, playerId }) => {
      const room = rooms[roomId];
      if (!room) return;

      const requester = room.players.find(p => p.id === socket.id);
      if (!requester || !requester.isHost) return;

      const playerToKick = room.players.find(p => p.id === playerId);
      if (playerToKick) {
        room.players = room.players.filter(p => p.id !== playerId);

        // Notify the kicked player
        io.to(playerId).emit('kicked');

        // Disconnect the socket from the room
        const kickedSocket = io.sockets.sockets.get(playerId);
        if (kickedSocket) {
          kickedSocket.leave(roomId);
        }

        broadcastState(roomId);
      }
    });

    socket.on('requestStartGame', ({ roomId }) => {
      const room = rooms[roomId];
      if (!room || room.phase !== 'lobby') return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player || !player.isHost) return;

      const activePlayers = room.players.filter(p => p.isConnected && p.role === 'player');
      if (activePlayers.length < 3) return;

      // Pick a random player to generate words
      const generator = activePlayers[Math.floor(Math.random() * activePlayers.length)];
      room.wordGeneratorId = generator.id;

      io.to(generator.id).emit('requestWords');
    });

    socket.on('setReady', ({ roomId }) => {
      const room = rooms[roomId];
      if (!room) return;
      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        player.isReady = !player.isReady;
      }
      broadcastState(roomId);
    });

    socket.on('startGame', ({ roomId, secretWord, imposterWord }) => {
      const room = rooms[roomId];
      if (!room || room.phase !== 'lobby') return;

      // Only the chosen generator can start the game with words
      if (socket.id !== room.wordGeneratorId) return;

      room.secretWord = secretWord;
      room.imposterWord = imposterWord;
      room.phase = 'playing';
      room.round = 1;
      room.messages = []; // Clear messages for new game

      const players = room.players.filter(p => p.role === 'player' && p.isConnected);
      // Shuffle players to ensure randomness in turn order and imposter selection
      const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);

      // Imposter cannot be the one who generated the words
      const potentialImposters = shuffledPlayers.filter(p => p.id !== room.wordGeneratorId);
      const imposterIndex = Math.floor(Math.random() * potentialImposters.length);
      const imposterId = potentialImposters[imposterIndex].id;

      room.players.forEach(p => {
        if (p.role !== 'spectator') {
          const isImposter = p.id === imposterId;
          p.role = isImposter ? 'imposter' : 'player';
          p.isEliminated = false;
          p.hints = [];
          p.isReady = false;
        }
      });

      room.turnOrder = shuffledPlayers.map(p => p.id);

      room.messages.push({
        id: Math.random().toString(36).substring(7),
        playerId: 'system',
        playerName: 'System',
        text: 'Game started! Round 1 begins.',
        timestamp: Date.now(),
        isSystem: true
      });

      room.currentTurnPlayerId = shuffledPlayers[0].id;
      startTimer(roomId, 45, () => {
        const currentPlayer = room.players.find(p => p.id === room.currentTurnPlayerId);
        if (currentPlayer) {
          room.messages.push({
            id: Math.random().toString(36).substring(7),
            playerId: currentPlayer.id,
            playerName: currentPlayer.name,
            text: 'No Guess Made',
            timestamp: Date.now(),
            isWarning: true
          });
          currentPlayer.hints.push('No Guess Made');
        }
        nextTurn(roomId);
      });
      broadcastState(roomId);
    });

    socket.on('submitHint', ({ roomId, hint }) => {
      const room = rooms[roomId];
      if (!room || room.phase !== 'playing' || room.currentTurnPlayerId !== socket.id) return;

      // Input validation: 1 word only, max 30 chars
      if (typeof hint !== 'string' || !hint.trim() || hint.trim().split(' ').length > 1 || hint.length > 30) {
        return;
      }

      const player = room.players.find(p => p.id === socket.id);
      if (player) {
        const sanitizedHint = escapeHtml(hint.trim());
        player.hints.push(sanitizedHint);
        room.messages.push({
          id: Math.random().toString(36).substring(7),
          playerId: player.id,
          playerName: player.name,
          text: sanitizedHint,
          timestamp: Date.now()
        });
        nextTurn(roomId);
      }
    });

    socket.on('submitVote', ({ roomId, votedId }) => {
      const room = rooms[roomId];
      if (!room || room.phase !== 'voting') return;

      room.lastVoteResults[socket.id] = votedId;

      const activeVoters = room.players.filter(p => !p.isEliminated && p.role !== 'spectator');
      if (Object.keys(room.lastVoteResults).length === activeVoters.length) {
        clearInterval(timers[roomId]);
        resolveVoting(roomId);
      }
      broadcastState(roomId);
    });

    socket.on('submitImposterGuess', ({ roomId, guess }) => {
      const room = rooms[roomId];
      if (!room || room.phase !== 'gameOver') return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player || player.role !== 'imposter') return;

      // Request validation from the host
      const host = room.players.find(p => p.isHost && p.isConnected);
      if (host) {
        io.to(host.id).emit('validateImposterGuess', { guess, secretWord: room.secretWord });
      } else {
        // If no host, fallback to simple check (though this shouldn't happen)
        const isCorrect = guess.trim().toLowerCase() === room.secretWord.toLowerCase();
        socket.emit('imposterGuessResult', { roomId, isCorrect });
      }
    });

    socket.on('imposterGuessResult', ({ roomId, isCorrect }) => {
      const room = rooms[roomId];
      if (!room) return;

      if (timers[roomId]) clearInterval(timers[roomId]);

      if (isCorrect) {
        room.phase = 'gameOver';
        room.winner = 'imposter';
      } else {
        room.phase = 'gameOver';
        room.winner = 'players';
      }
      broadcastState(roomId);
    });

    socket.on('resetGame', ({ roomId }) => {
      const room = rooms[roomId];
      if (!room) return;

      const player = room.players.find(p => p.id === socket.id);
      if (!player || !player.isHost) return;

      if (timers[roomId]) clearInterval(timers[roomId]);

      room.phase = 'lobby';
      room.players.forEach(p => {
        p.isReady = false;
        p.isEliminated = false;
        p.role = 'player';
        p.hints = [];
      });
      room.messages = [];
      room.secretWord = '';
      room.imposterWord = '';
      room.winner = null;
      room.eliminatedPlayerId = null;
      room.lastVoteResults = {};
      room.round = 1;
      room.currentTurnPlayerId = null;
      room.turnOrder = [];
      room.timer = 0;
      room.maxTimer = 0;

      broadcastState(roomId);
    });

    socket.on('disconnect', () => {
      // Find room and player
      Object.entries(rooms).forEach(([roomId, room]) => {
        const playerIndex = room.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
          const player = room.players[playerIndex];
          player.isConnected = false;

          if (room.phase === 'lobby') {
            room.players.splice(playerIndex, 1);
          }

          const activePlayers = room.players.filter(p => p.isConnected);
          if (activePlayers.length === 0) {
            delete rooms[roomId];
            return;
          }

          if (player.isHost) {
            player.isHost = false;
            if (activePlayers.length > 0) {
              activePlayers[0].isHost = true;
            }
          }

          broadcastState(roomId);
        }
      });
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
