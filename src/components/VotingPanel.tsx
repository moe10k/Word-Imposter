import { motion } from 'motion/react';
import { Vote, User, CheckCircle2 } from 'lucide-react';
import type { GameState, Player } from '../types';
import {
  didPlayerVoteFor,
  getActivePlayers,
  getVoteCount,
  hasPlayerVoted,
  isSpectatorPlayer,
} from '../utils/gameSelectors';

type VotingPanelProps = {
  gameState: GameState;
  socketId?: string;
  me?: Player;
  onSubmitVote: (playerId: string) => void;
  height?: string;
};

export default function VotingPanel({
  gameState,
  socketId,
  me,
  onSubmitVote,
  height = '700px',
}: VotingPanelProps) {
  const activeVoters = getActivePlayers(gameState);
  const votedCount = getVoteCount(gameState);
  const isSpectator = isSpectatorPlayer(me);

  return (
    <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl border border-slate-800 flex flex-col" style={{ height }}>
      <div className="flex items-center justify-between mb-8">
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
          <Vote className="w-4 h-4 text-amber-500" />
          Cast Your Vote
        </h3>
        <div className="flex items-center gap-3 bg-slate-950 px-4 py-2 rounded-xl border border-slate-800">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {votedCount} / {activeVoters.length} Voted
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {gameState.players.filter(p => p.role !== 'spectator').map((player) => {
            const hasVoted = hasPlayerVoted(gameState, socketId);
            const isMe = player.id === socketId;
            const isVotedByMe = didPlayerVoteFor(gameState, socketId, player.id);

            return (
              <motion.button
                key={player.id}
                whileHover={!isSpectator && !hasVoted && !isMe && !player.isEliminated ? { scale: 1.02 } : {}}
                whileTap={!isSpectator && !hasVoted && !isMe && !player.isEliminated ? { scale: 0.98 } : {}}
                onClick={() => onSubmitVote(player.id)}
                disabled={isSpectator || hasVoted || isMe || player.isEliminated}
                className={`group relative p-6 rounded-3xl border-2 transition-all flex items-center gap-4 text-left ${isMe || isSpectator || hasVoted || player.isEliminated
                  ? `opacity-50 cursor-not-allowed ${isVotedByMe ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 bg-slate-900/50'}`
                  : 'border-slate-800 bg-slate-900 hover:border-indigo-500 hover:bg-indigo-500/5 shadow-xl'
                  }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${isVotedByMe ? 'bg-indigo-500 text-white' :
                  isMe || player.isEliminated ? 'bg-slate-800 text-slate-600' : 'bg-slate-800 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white'
                  }`}>
                  <User className="w-6 h-6" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className={`font-black text-lg tracking-tight truncate ${player.isEliminated ? 'text-slate-600 line-through' : 'text-white'}`}>
                    {player.name}
                    {isMe && <span className="text-[10px] text-slate-500 ml-2">(You)</span>}
                  </div>
                  {!player.isEliminated && (
                    <div className="text-[10px] font-bold text-slate-400 italic truncate">
                      "{player.hints[player.hints.length - 1] || 'No hint yet'}"
                    </div>
                  )}
                </div>

                {isVotedByMe && (
                  <div className="bg-indigo-500 text-slate-950 p-1.5 rounded-lg">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-800">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
          {isSpectator ? 'Waiting for players to vote...' : (hasPlayerVoted(gameState, socketId) ? 'Vote cast! Waiting for others...' : 'Select a player to vote for them as the imposter.')}
        </p>
      </div>
    </div>
  );
}
