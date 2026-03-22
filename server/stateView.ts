import type { GameState, Player } from '../src/types.ts';

export function createPlayerStateView(room: GameState, player: Player): GameState {
  const filteredState = { ...room };

  if (room.phase === 'playing' || room.phase === 'voting') {
    if (player.role === 'imposter') {
      filteredState.secretWord = '';
    } else if (player.role === 'player') {
      filteredState.imposterWord = '';
    } else {
      filteredState.secretWord = '';
      filteredState.imposterWord = '';
    }
  } else if (room.phase === 'lobby') {
    filteredState.secretWord = '';
    filteredState.imposterWord = '';
  }

  return filteredState;
}
