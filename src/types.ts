export type PlayerRole = 'player' | 'imposter' | 'spectator';

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  createdAt: string;
}

export interface Message {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
  isSystem?: boolean;
  isWarning?: boolean;
}

export interface Player {
  id: string;
  name: string;
  role: PlayerRole;
  isEliminated: boolean;
  isHost: boolean;
  hints: string[];
  isReady: boolean;
  isConnected: boolean;
}

export interface GameState {
  roomId: string;
  phase: 'lobby' | 'playing' | 'voting' | 'gameOver';
  players: Player[];
  messages: Message[];
  secretWord: string;
  imposterWord: string;
  currentTurnPlayerId: string | null;
  turnOrder: string[];
  round: number;
  winner: 'players' | 'imposter' | null;
  gameOverReason: 'playersCaughtImposter' | 'imposterGuessedWord' | 'imposterOutlastedPlayers' | null;
  eliminatedPlayerId: string | null;
  imposterWinningGuess: string | null;
  wordGeneratorId?: string;
  lastVoteResults: Record<string, string>; // voterId -> votedId
  timer: number;
  maxTimer: number;
  imposterGuesses: number;
}
