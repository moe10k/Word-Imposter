import type { RefObject } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock, AlertCircle } from 'lucide-react';
import type { GameState, Player } from '../types';
import { getCurrentTurnPlayer, isSpectatorPlayer } from '../utils/gameSelectors';
import ChatPanel from './ChatPanel';
import PlayerList from './PlayerList';
import VotingPanel from './VotingPanel';

type PlayingScreenProps = {
  gameState: GameState;
  me?: Player;
  socketId?: string;
  isMyTurn: boolean;
  expandedPlayerIds: string[];
  onTogglePlayer: (playerId: string) => void;
  userHint: string;
  onUserHintChange: (value: string) => void;
  onSubmitHint: () => void;
  onSendChat: () => void;
  chatContainerRef: RefObject<HTMLDivElement | null>;
  imposterGuess: string;
  onImposterGuessChange: (value: string) => void;
  onSubmitImposterGuess: () => void;
  onSubmitVote: (playerId: string) => void;
};

export default function PlayingScreen({
  gameState,
  me,
  socketId,
  isMyTurn,
  expandedPlayerIds,
  onTogglePlayer,
  userHint,
  onUserHintChange,
  onSubmitHint,
  onSendChat,
  chatContainerRef,
  imposterGuess,
  onImposterGuessChange,
  onSubmitImposterGuess,
  onSubmitVote,
}: PlayingScreenProps) {
  const currentPlayer = getCurrentTurnPlayer(gameState);
  const isSpectator = isSpectatorPlayer(me);
  const isVoting = gameState.phase === 'voting';

  return (
    <div className="max-w-6xl mx-auto space-y-12 py-8 px-4 relative">
      <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl border border-slate-800 gap-6">
        <div className="space-y-1 text-center sm:text-left">
          <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
            {isVoting ? 'VOTING PHASE' : `Round ${gameState.round}`}
          </span>
          <h2 className="text-3xl font-black text-white flex flex-wrap items-center gap-4 justify-center sm:justify-start">
            <span>{isVoting ? 'Who is the Imposter?' : (isMyTurn ? 'Your Turn' : `${currentPlayer?.name}'s Turn`)}</span>
            {!isVoting && (
              <span className={`flex items-center gap-2 text-2xl font-black ${gameState.timer < 5 ? 'text-red-400 animate-pulse' : 'text-amber-300'}`}>
                <Clock className="w-5 h-5" />
                {gameState.timer}s
              </span>
            )}
            {!isVoting && isMyTurn && <div className="w-3 h-3 bg-amber-400 rounded-full shadow-[0_0_12px_rgba(251,191,36,0.9)]" />}
          </h2>
        </div>
        <div className="bg-slate-950/50 p-4 px-8 rounded-3xl border border-slate-800 flex flex-col items-center sm:items-end gap-1">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Your Word</span>
          <div className="text-3xl font-black text-indigo-400 tracking-tight">
            {isSpectator ? 'SPECTATING' : (me?.role === 'imposter' ? gameState.imposterWord : gameState.secretWord)}
          </div>
          {me?.role === 'imposter' && !isSpectator && (
            <span className="text-[9px] font-black text-red-500 uppercase tracking-widest block mt-1">You are the Imposter</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-8">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl border border-slate-800">
            <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Players</h3>
            <PlayerList
              gameState={gameState}
              me={me}
              socketId={socketId}
              expandedPlayerIds={expandedPlayerIds}
              onTogglePlayer={onTogglePlayer}
            />
          </div>

          {me?.role === 'imposter' && !isSpectator && !isVoting && (
            <div className="bg-red-500/10 rounded-[2.5rem] p-8 border border-red-500/20 space-y-6">
              <div className="flex items-center gap-2 text-red-500 font-black text-xs uppercase tracking-[0.2em]">
                <AlertCircle className="w-4 h-4" />
                Imposter Action
              </div>
              <p className="text-xs text-red-400 font-bold leading-relaxed">
                Guess the secret word to win instantly. Use this wisely!
              </p>
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Guesses left</span>
                  <span className="text-[10px] text-red-400 font-black">{gameState.imposterGuesses} / 3</span>
                </div>
                <input
                  type="text"
                  value={imposterGuess}
                  onChange={(e) => onImposterGuessChange(e.target.value.toUpperCase())}
                  placeholder="Guess the word..."
                  className="w-full bg-slate-800 border-2 border-red-500/20 rounded-2xl px-5 py-3 text-sm font-black text-white focus:outline-none focus:border-red-500 uppercase"
                />
                <button
                  onClick={onSubmitImposterGuess}
                  className="w-full bg-red-600 text-white py-4 rounded-2xl text-sm font-black hover:bg-red-700 transition-all shadow-lg shadow-red-900/20"
                >
                  Guess & Win
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {isVoting ? (
              <motion.div
                key="voting-section"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
              >
                <VotingPanel
                  gameState={gameState}
                  socketId={socketId}
                  me={me}
                  onSubmitVote={onSubmitVote}
                  height="700px"
                />
              </motion.div>
            ) : (
              <motion.div
                key="chat-section"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
              >
                <ChatPanel
                  gameState={gameState}
                  socketId={socketId}
                  me={me}
                  isMyTurn={isMyTurn}
                  userHint={userHint}
                  onUserHintChange={onUserHintChange}
                  onSubmitHint={onSubmitHint}
                  onSendChat={onSendChat}
                  chatContainerRef={chatContainerRef}
                  height="700px"
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
