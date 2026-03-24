import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut, RefreshCw, Sword, User } from 'lucide-react';
import type { AuthUser, GameState, Player } from '../types';

type NavbarProps = {
  authUser: AuthUser;
  phase?: GameState['phase'];
  me?: Player;
  onLogout: () => void;
  onResetGame: () => void;
};

export default function Navbar({
  authUser,
  phase = 'lobby',
  me,
  onLogout,
  onResetGame,
}: NavbarProps) {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isLobby = phase === 'lobby';

  useEffect(() => {
    setIsAccountMenuOpen(false);
  }, [phase]);

  useEffect(() => {
    if (!isAccountMenuOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsAccountMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAccountMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isAccountMenuOpen]);

  return (
    <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 h-20">
      <div className="max-w-[1560px] mx-auto px-6 h-full flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-600/20">
            <Sword className="w-6 h-6 text-white" />
          </div>
          <span className="font-black text-2xl tracking-tighter uppercase text-white">Word Imposter</span>
        </div>
        <div className="flex items-center gap-6">
          {me?.isHost && !isLobby && (
            <button
              onClick={onResetGame}
              className="bg-slate-900 hover:bg-slate-800 text-slate-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-800 flex items-center gap-2"
            >
              <RefreshCw className="w-3 h-3" />
              Reset to Lobby
            </button>
          )}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-expanded={isAccountMenuOpen}
              aria-haspopup="menu"
              onClick={() => setIsAccountMenuOpen(prev => !prev)}
              className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-300 transition-all hover:bg-slate-800 hover:text-white"
            >
              <span className="max-w-40 truncate">{authUser.username}</span>
              <ChevronDown
                className={`h-3 w-3 transition-transform ${isAccountMenuOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {isAccountMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 mt-3 w-56 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/40"
              >
                <div className="border-b border-slate-800 px-4 py-3">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">
                    Account
                  </p>
                  <p className="mt-1 text-sm font-bold text-white">{authUser.username}</p>
                  <p className="text-xs text-slate-500">{authUser.email}</p>
                </div>
                <div className="p-2">
                  {isLobby && (
                    <button
                      type="button"
                      role="menuitem"
                      disabled
                      className="flex w-full cursor-default items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-400"
                    >
                      <User className="h-4 w-4 shrink-0" />
                      <span className="flex-1">
                        <span className="block text-sm font-bold text-slate-300">Profile</span>
                        <span className="block text-[10px] font-black uppercase tracking-[0.25em] text-slate-500">
                          Coming Soon
                        </span>
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsAccountMenuOpen(false);
                      onLogout();
                    }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-slate-300 transition-all hover:bg-slate-800 hover:text-white"
                  >
                    <LogOut className="h-4 w-4 shrink-0" />
                    <span className="text-sm font-bold">Logout</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
