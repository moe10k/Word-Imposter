import { motion } from 'motion/react';
import { Trophy, RefreshCw } from 'lucide-react';
import type { GameState, Player } from '../types';

type GameOverScreenProps = {
  gameState: GameState;
  me?: Player;
  socketId?: string;
  onResetGame: () => void;
};

export default function GameOverScreen({
  gameState,
  me,
  socketId,
  onResetGame,
}: GameOverScreenProps) {
  const isWin = (gameState.winner === 'players' && me?.role === 'player') ||
    (gameState.winner === 'imposter' && me?.role === 'imposter');
  const imposter = gameState.players.find(player => player.role === 'imposter')!;
  const isImposterGuessWin = gameState.gameOverReason === 'imposterGuessedWord';
  const headline = isImposterGuessWin
    ? 'Imposter Guessed The Word!'
    : gameState.winner === 'players'
      ? 'Players Win!'
      : 'Imposter Wins!';
  const subheadline = isImposterGuessWin
    ? 'The imposter named the secret word during voting and stole the round.'
    : isWin
      ? 'Victory is yours!'
      : 'Defeat. Try again?';

  return (
    <div className="max-w-3xl mx-auto py-12 px-4 text-center space-y-16">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="space-y-8"
      >
        <div className={`w-40 h-40 rounded-full flex items-center justify-center mx-auto shadow-2xl ${isWin ? 'bg-emerald-500/10 shadow-emerald-500/10' : 'bg-red-500/10 shadow-red-500/10'}`}>
          <Trophy className={`w-20 h-20 ${isWin ? 'text-emerald-500' : 'text-red-500'}`} />
        </div>
        <div className="space-y-2">
          <h2 className="text-7xl font-black text-white tracking-tighter uppercase">
            {headline}
          </h2>
          <p className="text-3xl text-slate-400 font-bold">
            {subheadline}
          </p>
        </div>
      </motion.div>

      {isImposterGuessWin && (
        <div className="rounded-[3rem] border border-red-500/30 bg-[linear-gradient(135deg,rgba(127,29,29,0.4),rgba(15,23,42,0.96))] p-10 shadow-2xl shadow-red-950/20">
          <div className="space-y-3">
            <span className="text-xs font-black uppercase tracking-[0.3em] text-red-200">Instant Imposter Win</span>
            <div className="text-4xl font-black uppercase tracking-tight text-white">
              {imposter.name} guessed "{gameState.imposterWinningGuess ?? gameState.secretWord}"
            </div>
            <p className="text-base font-bold leading-relaxed text-red-100/90">
              The vote ended immediately because the imposter correctly identified the secret word.
            </p>
          </div>
        </div>
      )}

      <div className="bg-slate-900 rounded-[3rem] p-12 shadow-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-12 relative overflow-hidden">
        <div className="space-y-3">
          <span className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Secret Word</span>
          <div className="text-4xl font-black text-indigo-500 uppercase tracking-tight">{gameState.secretWord}</div>
        </div>
        <div className="space-y-3">
          <span className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Imposter Word</span>
          <div className="text-4xl font-black text-red-500 uppercase tracking-tight">{gameState.imposterWord}</div>
        </div>
        <div className="col-span-1 sm:col-span-2 pt-8 border-t border-slate-800">
          <span className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">The Imposter was</span>
          <div className="text-2xl font-black text-slate-200 mt-2">{imposter.name} {imposter.id === socketId ? '(You)' : ''}</div>
        </div>
      </div>

      {me?.isHost ? (
        <button
          onClick={onResetGame}
          className="bg-indigo-600 text-white px-16 py-6 rounded-[2rem] font-black text-2xl hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-900/20 flex items-center gap-4 mx-auto"
        >
          <RefreshCw className="w-8 h-8" />
          Play Again
        </button>
      ) : (
        <div className="text-slate-500 font-black text-xl animate-pulse">
          Waiting for host to start a new game...
        </div>
      )}
    </div>
  );
}
