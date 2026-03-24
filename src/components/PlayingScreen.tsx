import type { RefObject } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Clock } from 'lucide-react';
import type { GameState, Player } from '../types';
import { getCurrentTurnPlayer, isSpectatorPlayer } from '../utils/gameSelectors';
import ChatPanel from './ChatPanel';
import ImposterGuessCard from './ImposterGuessCard';
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
  onSubmitVote: (voteId: string) => void;
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
    <div className="max-w-[1560px] mx-auto space-y-12 py-8 px-4 relative">
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

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2.4fr)_minmax(360px,1fr)] lg:items-start">
        <div className="min-w-0 lg:order-1 space-y-8">
          {isVoting && me?.role === 'imposter' && !isSpectator ? (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(360px,0.94fr)_minmax(0,1.56fr)] xl:items-start">
              <ImposterGuessCard
                gameState={gameState}
                imposterGuess={imposterGuess}
                onImposterGuessChange={onImposterGuessChange}
                onSubmitImposterGuess={onSubmitImposterGuess}
              />
              <AnimatePresence mode="wait">
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
              </AnimatePresence>
            </div>
          ) : (
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
          )}
        </div>

        <div className="min-w-0 lg:order-2">
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
        </div>
      </div>
    </div>
  );
}
