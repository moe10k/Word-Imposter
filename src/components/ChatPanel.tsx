import { useEffect, type RefObject } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, User } from 'lucide-react';
import type { GameState, Player } from '../types';
import { isSpectatorPlayer } from '../utils/gameSelectors';

type ChatPanelProps = {
  gameState: GameState;
  socketId?: string;
  me?: Player;
  isMyTurn: boolean;
  userHint: string;
  onUserHintChange: (value: string) => void;
  onSubmitHint: () => void;
  onSendChat: () => void;
  chatContainerRef: RefObject<HTMLDivElement | null>;
  height?: string;
};

export default function ChatPanel({
  gameState,
  socketId,
  me,
  isMyTurn,
  userHint,
  onUserHintChange,
  onSubmitHint,
  onSendChat,
  chatContainerRef,
  height = '600px',
}: ChatPanelProps) {
  const isPlaying = gameState.phase === 'playing';
  const isSpectator = isSpectatorPlayer(me);

  useEffect(() => {
    let frameOne = 0;
    let frameTwo = 0;

    frameOne = window.requestAnimationFrame(() => {
      frameTwo = window.requestAnimationFrame(() => {
        const container = chatContainerRef.current;
        if (!container) {
          return;
        }

        container.scrollTop = container.scrollHeight;
      });
    });

    return () => {
      window.cancelAnimationFrame(frameOne);
      window.cancelAnimationFrame(frameTwo);
    };
  }, [chatContainerRef, gameState.messages.length, gameState.phase]);

  return (
    <div
      className="relative overflow-hidden rounded-[2.5rem] border border-amber-500/15 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(2,6,23,1))] p-8 shadow-2xl shadow-black/40"
      style={{ height }}
    >
      <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent" />

      <div className="flex h-full flex-col">
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-amber-500/12 pb-5">
          <h3 className="flex items-center gap-3 text-xs font-black uppercase tracking-[0.28em] text-amber-200/75">
            <MessageSquare className="h-4 w-4 text-amber-400" />
            {isPlaying ? 'Game Log & Hints' : 'Lobby Chat'}
          </h3>
          <div className="rounded-full border border-amber-500/20 bg-slate-950/70 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
            {gameState.messages.length} Entries
          </div>
        </div>

        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0"
        >
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {gameState.messages.map((msg) => {
                const isMe = msg.playerId === socketId;
                const isSystem = msg.isSystem;
                const isWarning = msg.isWarning;

                if (isSystem) {
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex justify-center py-0.5"
                    >
                      <span className="max-w-full whitespace-pre-wrap break-words rounded-full border border-amber-500/15 bg-slate-950/80 px-3 py-1 text-center text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                        {msg.text}
                      </span>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ x: isMe ? 20 : -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className={`flex items-start gap-3 ${isMe ? 'flex-row-reverse' : ''}`}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border shadow-lg ${isMe
                      ? 'border-amber-400/30 bg-amber-400/10 text-amber-100'
                      : 'border-slate-800 bg-slate-950 text-slate-500'
                      }`}>
                      <User className="h-4 w-4" />
                    </div>

                    <div className={`min-w-0 max-w-[85%] rounded-[1.5rem] border px-4 py-3 shadow-lg ${isMe
                      ? 'border-amber-400/20 bg-[linear-gradient(180deg,rgba(146,64,14,0.28),rgba(30,41,59,0.96))] text-white'
                      : 'border-slate-700/80 bg-slate-900/92 text-slate-200'
                      }`}>
                      <div className={`mb-1.5 flex min-w-0 items-center gap-2 ${isMe ? 'justify-end' : ''}`}>
                        <span className={`text-[9px] font-black uppercase tracking-[0.18em] ${isMe ? 'text-amber-200/75' : 'text-slate-500'}`}>
                          {msg.playerName}
                        </span>
                        <span className={`text-[8px] font-bold ${isMe ? 'text-amber-100/35' : 'text-slate-600'}`}>
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={`whitespace-pre-wrap break-words text-sm font-bold leading-snug ${isWarning ? 'text-red-400' : ''}`}>
                        {msg.text}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {(!isPlaying || (isMyTurn && !isSpectator)) && (
          <div className="mt-6 border-t border-amber-500/12 pt-6">
            <div className="flex gap-3">
              <input
                type="text"
                value={userHint}
                onChange={(e) => onUserHintChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (isPlaying) {
                      onSubmitHint();
                    } else {
                      onSendChat();
                    }
                  }
                }}
                placeholder={isPlaying ? 'Enter a hint...' : 'Type a message...'}
                className="flex-1 rounded-2xl border border-slate-700 bg-slate-900/90 px-6 py-4 text-base font-bold text-white shadow-inner shadow-black/20 transition-all placeholder:text-slate-500 focus:border-amber-400/45 focus:outline-none"
              />
              <button
                onClick={() => {
                  if (isPlaying) onSubmitHint();
                  else onSendChat();
                }}
                className="rounded-2xl border border-amber-400/30 bg-amber-400/90 px-8 py-4 text-base font-black text-slate-950 transition-all hover:bg-amber-300 shadow-xl shadow-amber-950/10"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
