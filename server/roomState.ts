import type { GameState, Message, Player } from '../src/types.ts';

export function escapeHtml(unsafe: string) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function createGameState(roomId: string): GameState {
  return {
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
    imposterGuesses: 1,
  };
}

export function createMessage(
  playerId: string,
  playerName: string,
  text: string,
  flags: Pick<Message, 'isSystem' | 'isWarning'> = {}
): Message {
  return {
    id: Math.random().toString(36).substring(7),
    playerId,
    playerName,
    text,
    timestamp: Date.now(),
    ...flags,
  };
}

export function getConnectedPlayers(room: GameState) {
  return room.players.filter(player => player.isConnected);
}

export function getConnectedPlayersByRole(room: GameState, role: Player['role']) {
  return room.players.filter(player => player.isConnected && player.role === role);
}

export function getActivePlayers(room: GameState) {
  return room.players.filter(player => !player.isEliminated && player.role !== 'spectator');
}

export function resetRoomToLobby(room: GameState) {
  room.phase = 'lobby';
  room.players.forEach(player => {
    player.isReady = false;
    player.isEliminated = false;
    player.role = 'player';
    player.hints = [];
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
  room.imposterGuesses = 1;
}
