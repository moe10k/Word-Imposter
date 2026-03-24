import type { RefObject } from 'react';
import { Users, Sword, CheckCircle2, Copy, Link as LinkIcon, Play, Clock, LogOut } from 'lucide-react';
import type { GameState, Player } from '../types';
import ChatPanel from './ChatPanel';
import PlayerList from './PlayerList';

type LobbyScreenProps = {
  gameState: GameState;
  me?: Player;
  socketId?: string;
  expandedPlayerIds: string[];
  onTogglePlayer: (playerId: string) => void;
  onKickPlayer: (playerId: string) => void;
  onCopyCode: () => void;
  onCopyLink: () => void;
  copyCodeSuccess: boolean;
  copySuccess: boolean;
  onRequestStartGame: () => void;
  onLeaveLobby: () => void;
  userHint: string;
  onUserHintChange: (value: string) => void;
  onSubmitHint: () => void;
  onSendChat: () => void;
  chatContainerRef: RefObject<HTMLDivElement | null>;
};

export default function LobbyScreen({
  gameState,
  me,
  socketId,
  expandedPlayerIds,
  onTogglePlayer,
  onKickPlayer,
  onCopyCode,
  onCopyLink,
  copyCodeSuccess,
  copySuccess,
  onRequestStartGame,
  onLeaveLobby,
  userHint,
  onUserHintChange,
  onSubmitHint,
  onSendChat,
  chatContainerRef,
}: LobbyScreenProps) {
  const startDisabled = gameState.players.filter(player => player.role === 'player').length < 3;

  return (
    <div className="flex flex-col gap-8 max-w-[1560px] mx-auto w-full font-sans">
      <div className="text-center space-y-4">
        <div className="bg-indigo-600 p-4 rounded-2xl inline-block shadow-xl shadow-indigo-500/20">
          <Sword className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-4xl font-black text-white tracking-tighter uppercase font-display">Lobby</h2>
        <div className="flex items-center justify-center gap-2 text-slate-500 font-bold text-sm tracking-widest uppercase">
          <Users className="w-4 h-4" />
          {gameState.players.length} Players Waiting
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2.35fr)_minmax(360px,1fr)] lg:items-start">
        <div className="order-1 min-w-0 lg:order-1">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(360px,0.96fr)_minmax(0,1.54fr)] xl:items-start">
            <div className="space-y-6">
              <div className="bg-slate-900 rounded-[2rem] p-8 shadow-2xl border border-slate-800 space-y-6">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Invite Friends</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <span className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">Room Code:</span>
                    <span className="text-2xl font-black font-mono text-indigo-400 tracking-widest uppercase mt-0.5">
                      {gameState.roomId}
                    </span>
                    <button
                      onClick={onCopyCode}
                      className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-indigo-400 hover:text-white transition-all shadow-sm flex items-center justify-center ml-2"
                      title="Copy Room Code"
                    >
                      {copyCodeSuccess ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>
                  <button
                    onClick={onCopyLink}
                    className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-xl font-bold transition-all border border-slate-700"
                  >
                    {copySuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <LinkIcon className="w-4 h-4" />}
                    {copySuccess ? 'Link Copied!' : 'Copy Invite Link'}
                  </button>
                </div>
              </div>

              {me?.isHost ? (
                <button
                  onClick={onRequestStartGame}
                  disabled={startDisabled}
                  className={`w-full py-6 rounded-2xl font-black text-xl transition-all shadow-xl flex items-center justify-center gap-3 ${startDisabled
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                    : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-900/20 active:scale-95'
                    }`}
                >
                  <Play className="w-6 h-6" />
                  Start Game
                </button>
              ) : (
                <div className="w-full py-6 rounded-2xl font-black text-xl bg-slate-800/50 text-slate-500 border border-slate-700/50 flex items-center justify-center gap-3 animate-pulse">
                  <Clock className="w-6 h-6" />
                  Waiting for Host...
                </div>
              )}

              {me?.isHost && startDisabled && (
                <p className="text-center text-slate-600 text-xs font-medium italic">
                  Need at least 3 players to start...
                </p>
              )}

              <button
                onClick={onLeaveLobby}
                className="w-full py-4 rounded-xl font-bold text-red-500 hover:text-white bg-slate-900 hover:bg-red-600 border border-slate-800 hover:border-red-500 transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <LogOut className="w-5 h-5" />
                Leave Lobby
              </button>
            </div>

            <ChatPanel
              gameState={gameState}
              socketId={socketId}
              me={me}
              isMyTurn={false}
              userHint={userHint}
              onUserHintChange={onUserHintChange}
              onSubmitHint={onSubmitHint}
              onSendChat={onSendChat}
              chatContainerRef={chatContainerRef}
              height="700px"
            />
          </div>
        </div>

        <div className="order-2 min-w-0 lg:order-2">
          <div className="bg-slate-900 rounded-[2rem] p-8 shadow-2xl border border-slate-800 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Player List</h3>
            </div>
            <PlayerList
              gameState={gameState}
              me={me}
              socketId={socketId}
              expandedPlayerIds={expandedPlayerIds}
              onTogglePlayer={onTogglePlayer}
              onKickPlayer={onKickPlayer}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
