import { motion, AnimatePresence } from 'motion/react';
import { User, XCircle, Clock, ChevronDown, LogOut, Crown } from 'lucide-react';
import type { GameState, Player } from '../types';

type PlayerListProps = {
  gameState: GameState;
  me?: Player;
  socketId?: string;
  expandedPlayerIds: string[];
  onTogglePlayer: (playerId: string) => void;
  onKickPlayer?: (playerId: string) => void;
};

export default function PlayerList({
  gameState,
  me,
  socketId,
  expandedPlayerIds,
  onTogglePlayer,
  onKickPlayer,
}: PlayerListProps) {
  const isPlaying = gameState.phase !== 'lobby';

  return (
    <div className="space-y-4">
      {gameState.players.map((player) => {
        const isExpanded = expandedPlayerIds.includes(player.id);
        const isCurrentTurn = gameState.currentTurnPlayerId === player.id;
        const highlightCard = isCurrentTurn && !player.isEliminated && isPlaying;
        const cardStateClasses = player.isEliminated
          ? 'opacity-40 grayscale border-transparent p-4'
          : highlightCard
            ? 'p-5 lg:p-6 border-amber-400/80 shadow-[0_20px_45px_rgba(251,191,36,0.25)] ring-1 ring-amber-200/60'
            : 'p-4 border-slate-800 hover:border-slate-700';
        const animatedBackground = player.isEliminated
          ? 'rgba(15, 23, 42, 0.35)'
          : highlightCard
            ? 'rgba(251, 191, 36, 0.12)'
            : 'rgba(30, 41, 59, 0.5)';

        return (
          <div key={player.id} className="space-y-2">
            <motion.div
              layout
              onClick={() => onTogglePlayer(player.id)}
              animate={{
                scale: highlightCard ? 1.06 : 1,
                backgroundColor: animatedBackground,
                boxShadow: highlightCard ? '0px 15px 35px rgba(251, 191, 36, 0.25)' : '0px 0px 0px rgba(0,0,0,0)'
              }}
              transition={highlightCard ? { duration: 1.4, repeat: Infinity, repeatType: 'reverse' } : { duration: 0.2 }}
              className={`flex items-center gap-4 rounded-2xl border-2 transition-all cursor-pointer ${cardStateClasses}`}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${player.id === socketId ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-500'}`}>
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-black text-slate-200 flex items-center gap-2 min-w-0">
                  <span className="truncate">{player.name}</span>
                  {player.id === socketId && <span className="text-[9px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-400 shrink-0">YOU</span>}
                </div>
                {player.role === 'spectator' && <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Spectating</div>}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {(player.isHost || (isCurrentTurn && !player.isEliminated && isPlaying)) && (
                  <div className="flex items-center gap-2 bg-slate-950/60 px-2 py-1 rounded-xl border border-slate-800/50">
                    {player.isHost && (
                      <span
                        className="w-6 h-6 rounded-full flex items-center justify-center bg-amber-500/20 text-amber-300 border border-amber-400/40"
                        title="Lobby Host"
                      >
                        <Crown className="w-3.5 h-3.5" />
                      </span>
                    )}
                    {isCurrentTurn && !player.isEliminated && isPlaying && (
                      <span className={`flex items-center gap-1 font-black text-[12px] tabular-nums ${gameState.timer < 5 ? 'text-red-400 animate-pulse' : 'text-amber-300'}`}>
                        <Clock className="w-3.5 h-3.5" />
                        {gameState.timer}s
                      </span>
                    )}
                  </div>
                )}
                {player.isEliminated && <XCircle className="w-5 h-5 text-red-500" />}
                {onKickPlayer && me?.isHost && player.id !== socketId && !isPlaying && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onKickPlayer(player.id);
                    }}
                    className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg transition-all border border-transparent hover:border-red-500/30"
                    title="Kick Player"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  className="text-slate-500"
                >
                  <ChevronDown className="w-4 h-4" />
                </motion.div>
              </div>
            </motion.div>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-slate-800/30 rounded-2xl p-4 border border-slate-800/50 space-y-2">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Hint History</span>
                    {player.hints.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {player.hints.map((hint, index) => (
                          <div key={index} className="flex flex-col gap-1 bg-slate-800/80 px-3 py-2 rounded-xl text-xs border border-slate-700/50">
                            <span className="text-slate-500 font-black uppercase text-[9px]">Round {index + 1}</span>
                            <span className="break-words text-slate-200 font-bold leading-snug">{hint}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-600 italic">No hints yet</span>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
