import type { RefObject } from 'react';
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

  return (
    <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl border border-slate-800 flex flex-col" style={{ height }}>
      <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-indigo-500" />
        {isPlaying ? 'Game Log & Hints' : 'Lobby Chat'}
      </h3>
      <div
        ref={chatContainerRef}
        className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar min-h-0"
      >
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
                  className="flex justify-center my-2"
                >
                  <span className="bg-slate-800/50 text-slate-500 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border border-slate-700/50">
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
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-lg ${isMe ? 'bg-indigo-600' : 'bg-slate-800'}`}>
                  <User className={`w-5 h-5 ${isMe ? 'text-white' : 'text-slate-500'}`} />
                </div>
                <div className={`group relative p-4 rounded-2xl max-w-[85%] shadow-lg ${isMe
                  ? 'bg-indigo-600 text-white rounded-tr-none'
                  : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                  }`}>
                  <div className={`flex items-center gap-2 mb-1 ${isMe ? 'justify-end' : ''}`}>
                    <span className="text-[10px] font-black opacity-60 uppercase tracking-widest">{msg.playerName}</span>
                    <span className="text-[9px] opacity-40 font-bold">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={`font-bold text-lg leading-tight ${isWarning ? 'text-red-400' : ''}`}>
                    {msg.text}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {(!isPlaying || (isMyTurn && !isSpectator)) && (
        <div className="mt-8 flex gap-3">
          <input
            type="text"
            value={userHint}
            onChange={(e) => onUserHintChange(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                if (isPlaying) {
                  onSubmitHint();
                } else {
                  onSendChat();
                }
              }
            }}
            placeholder={isPlaying ? 'Enter a 1-word hint...' : 'Type a message...'}
            className="flex-1 bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 font-bold text-white focus:outline-none focus:border-indigo-600 transition-all text-base"
          />
          <button
            onClick={() => {
              if (isPlaying) onSubmitHint();
              else onSendChat();
            }}
            className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-base hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-900/20"
          >
            Send
          </button>
        </div>
      )}
    </div>
  );
}
