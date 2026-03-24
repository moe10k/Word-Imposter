import type { Server } from 'socket.io';
import type { GameState } from '../src/types.ts';
import { isSkipVoteId } from '../src/constants/voting.ts';
import { generateGameWords } from '../src/services/openai.ts';
import {
  createGameState,
  createMessage,
  escapeHtml,
  getActivePlayers,
  getConnectedPlayers,
  getConnectedPlayersByRole,
  resetRoomToLobby,
} from './roomState.ts';
import { handleTurnTimeout, initializeGame } from './gameFlow.ts';

type RateLimitedEvent = 'requestStartGame' | 'submitImposterGuess';

type RegisterSocketHandlersParams = {
  io: Server;
  rooms: Record<string, GameState>;
  rateLimitTracker: Map<string, Partial<Record<RateLimitedEvent, number>>>;
  checkRateLimit: (socketId: string, event: RateLimitedEvent) => number;
  broadcastState: (roomId: string) => void;
  startTimer: (roomId: string, seconds: number, onComplete: () => void) => void;
  clearTimer: (roomId: string) => void;
  runNextTurn: (roomId: string) => void;
  runResolveVoting: (roomId: string) => void;
};

export function registerSocketHandlers({
  io,
  rooms,
  rateLimitTracker,
  checkRateLimit,
  broadcastState,
  startTimer,
  clearTimer,
  runNextTurn,
  runResolveVoting,
}: RegisterSocketHandlersParams) {
  io.on('connection', (socket) => {
    socket.on('joinRoom', ({ roomId }) => {
      if (typeof roomId !== 'string' || !/^[a-z0-9]{1,20}$/i.test(roomId)) return;

      const authUser = socket.data.authUser as { username?: string } | null | undefined;
      if (!authUser?.username) {
        socket.emit('joinError', 'You must be logged in to join a room.');
        return;
      }

      const sanitizedName = escapeHtml(authUser.username.trim());

      if (!rooms[roomId]) {
        rooms[roomId] = createGameState(roomId);
      }
      const room = rooms[roomId];

      const existingPlayer = room.players.find(player => player.name === sanitizedName);
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

      if (typeof text !== 'string' || !text.trim() || text.length > 200) return;

      const player = room.players.find(currentPlayer => currentPlayer.id === socket.id);
      if (player) {
        room.messages.push(createMessage(player.id, player.name, text.trim()));

        if (room.messages.length > 100) {
          room.messages.shift();
        }

        broadcastState(roomId);
      }
    });

    socket.on('kickPlayer', ({ roomId, playerId }) => {
      const room = rooms[roomId];
      if (!room) return;

      const requester = room.players.find(player => player.id === socket.id);
      if (!requester || !requester.isHost) return;

      const playerToKick = room.players.find(player => player.id === playerId);
      if (playerToKick) {
        room.players = room.players.filter(player => player.id !== playerId);

        io.to(playerId).emit('kicked');

        const kickedSocket = io.sockets.sockets.get(playerId);
        if (kickedSocket) {
          kickedSocket.leave(roomId);
        }

        broadcastState(roomId);
      }
    });

    socket.on('requestStartGame', async ({ roomId }) => {
      const room = rooms[roomId];
      if (!room || room.phase !== 'lobby') return;

      const player = room.players.find(currentPlayer => currentPlayer.id === socket.id);
      if (!player || !player.isHost) return;

      const retryIn = checkRateLimit(socket.id, 'requestStartGame');
      if (retryIn > 0) {
        socket.emit('rateLimited', { event: 'requestStartGame', retryInMs: retryIn });
        return;
      }

      const activePlayers = getConnectedPlayersByRole(room, 'player');
      if (activePlayers.length < 3) return;

      try {
        const { secretWord, imposterWord } = await generateGameWords();

        initializeGame(room, secretWord, imposterWord);
        startTimer(roomId, 45, () => {
          handleTurnTimeout(room);
          runNextTurn(roomId);
        });
        broadcastState(roomId);
      } catch (error) {
        console.error('Failed to start game:', error);
      }
    });

    socket.on('setReady', ({ roomId }) => {
      const room = rooms[roomId];
      if (!room) return;

      const player = room.players.find(currentPlayer => currentPlayer.id === socket.id);
      if (player) {
        player.isReady = !player.isReady;
      }
      broadcastState(roomId);
    });

    socket.on('submitHint', ({ roomId, hint }) => {
      const room = rooms[roomId];
      if (!room || room.phase !== 'playing' || room.currentTurnPlayerId !== socket.id) return;

      if (typeof hint !== 'string') {
        return;
      }

      const sanitizedHint = hint.trim();
      if (!sanitizedHint || sanitizedHint.length > 120) {
        return;
      }

      const player = room.players.find(currentPlayer => currentPlayer.id === socket.id);
      if (player) {
        player.hints.push(sanitizedHint);
        room.messages.push(createMessage(player.id, player.name, sanitizedHint));
        runNextTurn(roomId);
      }
    });

    socket.on('submitVote', ({ roomId, votedId }) => {
      const room = rooms[roomId];
      if (!room || room.phase !== 'voting') return;

      const voter = room.players.find(currentPlayer => currentPlayer.id === socket.id);
      if (!voter || voter.role === 'spectator' || voter.isEliminated) return;
      if (typeof votedId !== 'string' || room.lastVoteResults[socket.id]) return;

      const isValidPlayerTarget = room.players.some(player =>
        player.id === votedId &&
        player.id !== socket.id &&
        !player.isEliminated &&
        player.role !== 'spectator'
      );
      const isValidVote = isSkipVoteId(votedId) || isValidPlayerTarget;
      if (!isValidVote) return;

      room.lastVoteResults[socket.id] = votedId;

      const activeVoters = getActivePlayers(room);
      if (Object.keys(room.lastVoteResults).length === activeVoters.length) {
        clearTimer(roomId);
        runResolveVoting(roomId);
      }
      broadcastState(roomId);
    });

    socket.on('submitImposterGuess', ({ roomId, guess }) => {
      const room = rooms[roomId];
      if (!room || room.phase !== 'voting') return;

      const player = room.players.find(currentPlayer => currentPlayer.id === socket.id);
      if (!player || player.role !== 'imposter' || player.isEliminated) return;
      if (room.imposterGuesses <= 0) return;

      if (typeof guess !== 'string') return;
      const sanitizedGuess = guess.trim();
      if (!sanitizedGuess || sanitizedGuess.length > 50) return;

      const retryIn = checkRateLimit(socket.id, 'submitImposterGuess');
      if (retryIn > 0) {
        socket.emit('rateLimited', { event: 'submitImposterGuess', retryInMs: retryIn });
        return;
      }

      room.imposterGuesses--;

      const isCorrect = sanitizedGuess.toLowerCase() === room.secretWord.toLowerCase();

      if (isCorrect) {
        clearTimer(roomId);
        room.messages.push(
          createMessage('system', 'System', `The Imposter guessed "${room.secretWord}" and stole the win!`, {
            isSystem: true
          })
        );
        room.phase = 'gameOver';
        room.winner = 'imposter';
        room.gameOverReason = 'imposterGuessedWord';
        room.imposterWinningGuess = sanitizedGuess;
      } else if (room.imposterGuesses <= 0) {
        room.messages.push(
          createMessage('system', 'System', `The Imposter guessed "${sanitizedGuess}" incorrectly and is out of guesses for this round.`, {
            isSystem: true
          })
        );
      } else {
        room.messages.push(
          createMessage('system', 'System', 'The Imposter guessed incorrectly!', {
            isSystem: true
          })
        );
      }
      broadcastState(roomId);
    });

    socket.on('resetGame', ({ roomId }) => {
      const room = rooms[roomId];
      if (!room) return;

      const player = room.players.find(currentPlayer => currentPlayer.id === socket.id);
      if (!player || !player.isHost) return;

      clearTimer(roomId);
      resetRoomToLobby(room);

      broadcastState(roomId);
    });

    socket.on('disconnect', () => {
      rateLimitTracker.delete(socket.id);
      Object.entries(rooms).forEach(([roomId, room]) => {
        const playerIndex = room.players.findIndex(player => player.id === socket.id);
        if (playerIndex !== -1) {
          const player = room.players[playerIndex];
          player.isConnected = false;

          if (room.phase === 'lobby') {
            room.players.splice(playerIndex, 1);
          }

          const activePlayers = getConnectedPlayers(room);
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
}
