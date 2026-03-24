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
            {voteTargets.map((player, index) => {
              const isMe = player.id === socketId;
              const isVotedByMe = didPlayerVoteFor(gameState, socketId, player.id);
              const isDisabled = isSpectator || hasVoted || isMe || player.isEliminated;
              const latestHint = player.hints[player.hints.length - 1] || 'No hint yet';

              return (
                <motion.button
                  key={player.id}
                  whileHover={!isDisabled ? { x: 3 } : {}}
                  whileTap={!isDisabled ? { scale: 0.995 } : {}}
                  onClick={() => onSubmitVote(player.id)}
                  disabled={isDisabled}
                  className={`group flex w-full items-center gap-4 rounded-[1.75rem] border px-5 py-4 text-left transition-all ${isVotedByMe
                    ? 'border-amber-400/60 bg-amber-400/10 shadow-[0_12px_28px_rgba(245,158,11,0.12)]'
                    : isDisabled
                      ? 'cursor-not-allowed border-slate-800 bg-slate-900/55 opacity-55'
                      : 'border-slate-700/80 bg-slate-900/85 hover:border-amber-400/45 hover:bg-slate-900 hover:shadow-[0_12px_28px_rgba(15,23,42,0.55)]'
                    }`}
                >
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border text-sm font-black transition-all ${isVotedByMe
                    ? 'border-amber-300/70 bg-amber-300/15 text-amber-200'
                    : player.isEliminated
                      ? 'border-slate-800 bg-slate-950 text-slate-600'
                      : isMe
                        ? 'border-slate-700 bg-slate-950 text-slate-400'
                        : 'border-amber-500/15 bg-slate-950 text-amber-300 group-hover:border-amber-400/45'
                    }`}>
                    {index + 1}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <div className={`truncate text-lg font-black tracking-tight ${player.isEliminated ? 'text-slate-600 line-through' : 'text-white'}`}>
                        {player.name}
                      </div>
                      {isMe && (
                        <span className="rounded-full border border-slate-700 bg-slate-950 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
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
                        <span className="rounded-full border border-slate-800 bg-slate-950 px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                          Out
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Last Hint
                      </span>
                      <span className={`whitespace-normal break-words text-sm leading-snug ${player.isEliminated ? 'text-slate-600' : 'text-slate-300'}`}>
                        {latestHint}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isVotedByMe && (
                      <div className="rounded-xl border border-amber-300/50 bg-amber-300/15 p-2 text-amber-200">
                        <CheckCircle2 className="h-4 w-4" />
                      </div>
                    )}
                    <div className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] ${isDisabled
                      ? 'border-slate-800 bg-slate-950 text-slate-600'
                      : 'border-amber-500/20 bg-slate-950 text-amber-200'
                      }`}>
                      {player.isEliminated ? 'Unavailable' : isMe ? 'Cannot vote self' : 'Vote'}
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
            className={`flex w-full items-center justify-between gap-4 rounded-[1.75rem] border px-5 py-4 text-left transition-all ${didSkipVote
              ? 'border-amber-400/60 bg-amber-400/10 shadow-[0_12px_28px_rgba(245,158,11,0.12)]'
              : isSpectator || hasVoted
                ? 'cursor-not-allowed border-slate-800 bg-slate-900/55 opacity-55'
                : 'border-slate-700/80 bg-slate-900/90 hover:border-amber-400/45 hover:bg-slate-900'
              }`}
          >
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl border ${didSkipVote
                ? 'border-amber-300/70 bg-amber-300/15 text-amber-200'
                : 'border-amber-500/15 bg-slate-950 text-amber-300'
                }`}>
                <MinusCircle className="h-6 w-6" />
              </div>
              <div>
                <div className="text-lg font-black tracking-tight text-white">Skip vote this round</div>
              </div>
            </div>
            {didSkipVote && (
              <div className="rounded-xl border border-amber-300/50 bg-amber-300/15 p-2 text-amber-200">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            )}
          </motion.button>

          <p className="mt-4 text-center text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
            {isSpectator
              ? 'Waiting for players to finish voting.'
              : hasVoted
                ? 'Vote locked in. Waiting for the rest of the table.'
                : 'Select one player or skip the round.'}
          </p>
        </div>
      </div>
    </div>
  );
}
