import type { GameState } from '../src/types.ts';
import {
  createMessage,
  getActivePlayers,
  getConnectedPlayersByRole,
} from './roomState.ts';

type Rooms = Record<string, GameState>;

type NextTurnDeps = {
  broadcastState: (roomId: string) => void;
  startTimer: (roomId: string, seconds: number, onComplete: () => void) => void;
  clearRoundTimer: (roomId: string) => void;
  nextTurn: (roomId: string) => void;
};

type CheckWinConditionDeps = {
  broadcastState: (roomId: string) => void;
  clearTimer: (roomId: string) => void;
  nextTurn: (roomId: string) => void;
};

type ResolveVotingDeps = {
  broadcastState: (roomId: string) => void;
  checkWinCondition: (roomId: string) => void;
};

export function handleTurnTimeout(room: GameState) {
  const currentPlayer = room.players.find(player => player.id === room.currentTurnPlayerId);
  if (!currentPlayer) {
    return;
  }

  currentPlayer.hints.push('No Guess Made');
  room.messages.push(
    createMessage(currentPlayer.id, currentPlayer.name, 'No Guess Made', { isWarning: true })
  );
}

export function initializeGame(room: GameState, secretWord: string, imposterWord: string) {
  room.secretWord = secretWord;
  room.imposterWord = imposterWord;
  room.phase = 'playing';
  room.round = 1;
  room.messages = [];
  room.imposterGuesses = 3;

  const players = getConnectedPlayersByRole(room, 'player');
  const shuffledPlayers = [...players].sort(() => Math.random() - 0.5);
  const imposterIndex = Math.floor(Math.random() * shuffledPlayers.length);
  const imposterId = shuffledPlayers[imposterIndex].id;

  room.players.forEach(player => {
    if (player.role !== 'spectator') {
      const isImposter = player.id === imposterId;
      player.role = isImposter ? 'imposter' : 'player';
      player.isEliminated = false;
      player.hints = [];
      player.isReady = false;
    }
  });

  room.turnOrder = shuffledPlayers.map(player => player.id);
  room.messages.push(createMessage('system', 'System', 'Game started! Round 1 begins.', { isSystem: true }));
  room.currentTurnPlayerId = shuffledPlayers[0].id;
}

export function nextTurn(roomId: string, rooms: Rooms, deps: NextTurnDeps) {
  const room = rooms[roomId];
  if (!room) return;

  const activePlayers = getActivePlayers(room);
  if (activePlayers.length === 0) return;

  const activeTurnOrder = room.turnOrder.filter(id =>
    activePlayers.some(player => player.id === id)
  );

  if (activeTurnOrder.length === 0) return;

  const currentIndex = activeTurnOrder.indexOf(room.currentTurnPlayerId || '');
  const nextIndex = (currentIndex + 1) % activeTurnOrder.length;

  if (nextIndex === 0 && currentIndex !== -1) {
    deps.clearRoundTimer(roomId);
    room.phase = 'voting';
    room.currentTurnPlayerId = null;
    room.messages.push(
      createMessage('system', 'System', 'Round finished! Time to vote.', { isSystem: true })
    );
    room.timer = 0;
    room.maxTimer = 0;
  } else {
    room.currentTurnPlayerId = activeTurnOrder[nextIndex];
    deps.startTimer(roomId, 45, () => {
      handleTurnTimeout(room);
      deps.nextTurn(roomId);
    });
  }

  deps.broadcastState(roomId);
}

export function checkWinCondition(roomId: string, rooms: Rooms, deps: CheckWinConditionDeps) {
  const room = rooms[roomId];
  if (!room) return;

  const eliminatedPlayer = room.players.find(player => player.id === room.eliminatedPlayerId);
  const activePlayers = getActivePlayers(room);

  if (eliminatedPlayer?.role === 'imposter') {
    room.phase = 'gameOver';
    room.winner = 'players';
    deps.clearTimer(roomId);
  } else if (activePlayers.length <= 2) {
    room.phase = 'gameOver';
    room.winner = 'imposter';
    deps.clearTimer(roomId);
  } else {
    room.phase = 'playing';
    room.round++;
    room.lastVoteResults = {};
    room.eliminatedPlayerId = null;
    room.currentTurnPlayerId = null;
    room.imposterGuesses = 3;
    deps.nextTurn(roomId);
  }

  deps.broadcastState(roomId);
}

export function resolveVoting(roomId: string, rooms: Rooms, deps: ResolveVotingDeps) {
  const room = rooms[roomId];
  if (!room) return;

  const voteCounts: Record<string, number> = {};
  Object.values(room.lastVoteResults).forEach(id => {
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
    const eliminatedPlayer = room.players.find(player => player.id === eliminatedId);
    if (eliminatedPlayer) {
      eliminatedPlayer.isEliminated = true;
      room.messages.push(
        createMessage(
          'system',
          'System',
          `${eliminatedPlayer.name} was voted out!`,
          { isSystem: true }
        )
      );
    }
    deps.checkWinCondition(roomId);
  } else {
    room.messages.push(
      createMessage('system', 'System', 'No one was voted out this round.', { isSystem: true })
    );
    deps.checkWinCondition(roomId);
  }

  deps.broadcastState(roomId);
}
