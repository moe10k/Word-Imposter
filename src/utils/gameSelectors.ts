import type { GameState, Player } from '../types';

export function getPlayerById(gameState: GameState | null, playerId?: string | null) {
  return gameState?.players.find(player => player.id === playerId);
}

export function isCurrentTurn(gameState: GameState | null, playerId?: string | null) {
  return gameState?.currentTurnPlayerId === playerId;
}

export function getMessageCount(gameState: GameState | null) {
  return gameState?.messages.length || 0;
}

export function isSpectatorPlayer(player?: Player) {
  return player?.role === 'spectator' || player?.isEliminated;
}

export function getActivePlayers(gameState: GameState | null) {
  if (!gameState) {
    return [];
  }

  return gameState.players.filter(player => !player.isEliminated && player.role !== 'spectator');
}

export function getVoteCount(gameState: GameState | null) {
  return Object.keys(gameState?.lastVoteResults || {}).length;
}

export function hasPlayerVoted(gameState: GameState | null, playerId?: string | null) {
  return !!gameState?.lastVoteResults[playerId || ''];
}

export function didPlayerVoteFor(
  gameState: GameState | null,
  voterId: string | null | undefined,
  votedPlayerId: string
) {
  return gameState?.lastVoteResults[voterId || ''] === votedPlayerId;
}

export function getCurrentTurnPlayer(gameState: GameState | null) {
  return getPlayerById(gameState, gameState?.currentTurnPlayerId);
}

export function getAlivePlayerCount(gameState: GameState | null) {
  return getActivePlayers(gameState).length;
}
