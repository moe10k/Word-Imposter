import { AlertCircle } from 'lucide-react';
import type { GameState } from '../types';

type ImposterGuessCardProps = {
  gameState: GameState;
  imposterGuess: string;
  onImposterGuessChange: (value: string) => void;
  onSubmitImposterGuess: () => void;
};

export default function ImposterGuessCard({
  gameState,
  imposterGuess,
  onImposterGuessChange,
  onSubmitImposterGuess,
}: ImposterGuessCardProps) {
  const canGuessWord = gameState.imposterGuesses > 0;

  return (
    <div className="rounded-[2.5rem] border border-red-500/25 bg-[linear-gradient(180deg,rgba(69,10,10,0.55),rgba(15,23,42,0.98))] p-8 shadow-2xl shadow-red-950/10">
      <div className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-red-300">
            <AlertCircle className="h-4 w-4" />
            Imposter Action
          </div>
          <p className="text-sm font-bold leading-relaxed text-red-100">
            During voting, you get one chance to guess the secret word and steal the win instantly.
          </p>
        </div>

        <div className="rounded-2xl border border-red-500/20 bg-slate-950/70 px-4 py-3 text-[10px] font-black uppercase tracking-[0.22em] text-red-200">
          Chances this round: {gameState.imposterGuesses} / 1
        </div>

        <div className="space-y-3">
          <input
            type="text"
            value={imposterGuess}
            onChange={(e) => onImposterGuessChange(e.target.value.toUpperCase())}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && canGuessWord) {
                e.preventDefault();
                onSubmitImposterGuess();
              }
            }}
            disabled={!canGuessWord}
            placeholder={canGuessWord ? 'Guess the secret word...' : 'Your voting guess chance is spent'}
            className="w-full rounded-2xl border-2 border-red-500/20 bg-slate-900/90 px-5 py-3 text-sm font-black uppercase text-white transition-all placeholder:text-slate-500 focus:border-red-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-55"
          />
          <button
            onClick={onSubmitImposterGuess}
            disabled={!canGuessWord}
            className="w-full rounded-2xl bg-red-600 px-6 py-4 text-sm font-black text-white transition-all shadow-lg shadow-red-900/20 hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-950/70 disabled:text-red-200/60"
          >
            Guess & Win
          </button>
        </div>
      </div>
    </div>
  );
}
