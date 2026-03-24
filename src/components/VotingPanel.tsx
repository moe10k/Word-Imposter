import { motion } from 'motion/react';
import { Vote, CheckCircle2, MinusCircle, Crown } from 'lucide-react';
import type { GameState, Player } from '../types';
import { SKIP_VOTE_ID } from '../constants/voting';
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
  const hasVoted = hasPlayerVoted(gameState, socketId);
  const didSkipVote = didPlayerVoteFor(gameState, socketId, SKIP_VOTE_ID);
  const voteTargets = gameState.players.filter(player => player.role !== 'spectator');
  const totalPossibleVotes = Math.max(activeVoters.length, 1);
  const voteTotals = Object.values(gameState.lastVoteResults).reduce<Record<string, number>>((totals, votedId) => {
    totals[votedId] = (totals[votedId] ?? 0) + 1;
    return totals;
  }, {});
  const skipVoteCount = voteTotals[SKIP_VOTE_ID] ?? 0;
  const skipVoteWidth = `${(skipVoteCount / totalPossibleVotes) * 100}%`;

  return (
    <div
      className="relative overflow-hidden rounded-[2.5rem] border border-amber-500/15 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,1))] p-8 shadow-2xl shadow-black/40"
      style={{ height }}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />

      <div className="flex h-full flex-col">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-3">
            <h3 className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.28em] text-amber-200/75">
              <Vote className="h-4 w-4 text-amber-400" />
              Voting Phase
            </h3>
            <div>
              <div className="text-3xl font-black tracking-tight text-white">Choose one suspect</div>
            </div>
          </div>
          <div className="inline-flex items-center gap-3 self-start rounded-2xl border border-amber-500/20 bg-slate-950/80 px-5 py-3 shadow-lg shadow-black/20">
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
              Votes Cast
            </span>
            <span className="text-lg font-black tracking-tight text-amber-300">
              {votedCount} / {activeVoters.length}
            </span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          <div className="space-y-3">
            {voteTargets.map((player) => {
              const isMe = player.id === socketId;
              const isVotedByMe = didPlayerVoteFor(gameState, socketId, player.id);
              const isDisabled = isSpectator || hasVoted || isMe || player.isEliminated;
              const latestHint = player.hints[player.hints.length - 1] || 'No hint yet';
              const optionVoteCount = voteTotals[player.id] ?? 0;
              const optionVoteWidth = `${(optionVoteCount / totalPossibleVotes) * 100}%`;

              return (
                <motion.button
                  key={player.id}
                  whileHover={!isDisabled ? { y: -1 } : {}}
                  whileTap={!isDisabled ? { scale: 0.995 } : {}}
                  onClick={() => onSubmitVote(player.id)}
                  disabled={isDisabled}
                  className={`group relative w-full overflow-hidden rounded-[1.5rem] border px-5 py-4 text-left transition-all ${isVotedByMe
                    ? 'border-amber-400/60 bg-amber-400/10 shadow-[0_12px_28px_rgba(245,158,11,0.12)]'
                    : isDisabled
                      ? 'cursor-not-allowed border-slate-800 bg-slate-900/55 opacity-55'
                      : 'border-slate-700/80 bg-slate-900/85 hover:border-amber-400/45 hover:bg-slate-900 hover:shadow-[0_12px_28px_rgba(15,23,42,0.55)]'
                    }`}
                >
                  <div
                    className={`pointer-events-none absolute inset-y-0 left-0 rounded-[1.5rem] bg-amber-400/12 transition-[width] duration-200 ${optionVoteCount > 0 ? 'opacity-100' : 'opacity-0'}`}
                    style={{ width: optionVoteWidth }}
                  />

                  <div className="relative z-10 flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <div className={`truncate text-lg font-black tracking-tight ${player.isEliminated ? 'text-slate-600 line-through' : 'text-white'}`}>
                          {player.name}
                        </div>
                        {isMe && (
                          <span className="rounded-full border border-slate-700 bg-slate-950/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                            You
                          </span>
                        )}
                        {player.isHost && !player.isEliminated && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-amber-200">
                            <Crown className="h-3 w-3" />
                            Host
                          </span>
                        )}
                        {player.isEliminated && (
                          <span className="rounded-full border border-slate-800 bg-slate-950/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                            Out
                          </span>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                          Last Hint
                        </span>
                        <span className={`whitespace-normal break-words text-sm leading-snug ${player.isEliminated ? 'text-slate-600' : 'text-slate-300'}`}>
                          {latestHint}
                        </span>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <div className={`min-w-10 rounded-full border px-3 py-1 text-center text-sm font-black ${optionVoteCount > 0
                        ? 'border-amber-400/35 bg-slate-950/85 text-amber-200'
                        : 'border-slate-800 bg-slate-950/75 text-slate-500'
                        }`}>
                        {optionVoteCount}
                      </div>
                      {isVotedByMe && (
                        <div className="text-amber-200">
                          <CheckCircle2 className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 border-t border-amber-500/15 pt-5">
          <motion.button
            whileHover={!isSpectator && !hasVoted ? { y: -1 } : {}}
            whileTap={!isSpectator && !hasVoted ? { scale: 0.995 } : {}}
            onClick={() => onSubmitVote(SKIP_VOTE_ID)}
            disabled={isSpectator || hasVoted}
            className={`relative w-full overflow-hidden rounded-[1.5rem] border px-5 py-4 text-left transition-all ${didSkipVote
              ? 'border-amber-400/60 bg-amber-400/10 shadow-[0_12px_28px_rgba(245,158,11,0.12)]'
              : isSpectator || hasVoted
                ? 'cursor-not-allowed border-slate-800 bg-slate-900/55 opacity-55'
                : 'border-slate-700/80 bg-slate-900/90 hover:border-amber-400/45 hover:bg-slate-900'
              }`}
          >
            <div
              className={`pointer-events-none absolute inset-y-0 left-0 rounded-[1.5rem] bg-amber-400/12 transition-[width] duration-200 ${skipVoteCount > 0 ? 'opacity-100' : 'opacity-0'}`}
              style={{ width: skipVoteWidth }}
            />
            <div className="relative z-10 flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <MinusCircle className="h-5 w-5 shrink-0 text-amber-300" />
                <div className="truncate text-lg font-black tracking-tight text-white">Skip vote this round</div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <div className={`min-w-10 rounded-full border px-3 py-1 text-center text-sm font-black ${skipVoteCount > 0
                  ? 'border-amber-400/35 bg-slate-950/85 text-amber-200'
                  : 'border-slate-800 bg-slate-950/75 text-slate-500'
                  }`}>
                  {skipVoteCount}
                </div>
                {didSkipVote && (
                  <div className="text-amber-200">
                    <CheckCircle2 className="h-4 w-4" />
                  </div>
                )}
              </div>
            </div>
          </motion.button>
        </div>
      </div>
    </div>
  );
}
