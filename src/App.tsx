import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Sword, AlertCircle, RefreshCw, LogOut } from 'lucide-react';
import GameOverScreen from './components/GameOverScreen';
import LobbyScreen from './components/LobbyScreen';
import PlayingScreen from './components/PlayingScreen';
import { useGameClient } from './hooks/useGameClient';
import { getAlivePlayerCount, getMessageCount } from './utils/gameSelectors';
import { copyText } from './utils/clipboard';

export default function App() {
  const {
    authError,
    authStatus,
    authUser,
    clearAuthError,
    createLobby,
    gameState,
    inputRoomId,
    isAuthSubmitting,
    isJoined,
    isMyTurn,
    joinError,
    joinGame,
    kickPlayer,
    login,
    logout,
    me,
    requestStartGame,
    resetGame,
    sendChatMessage,
    setInputRoomId,
    socketId,
    signup,
    submitHint,
    submitImposterGuess,
    submitVote,
  } = useGameClient();
  const [userHint, setUserHint] = useState('');
  const [imposterGuess, setImposterGuess] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authForm, setAuthForm] = useState({
    username: '',
    email: '',
    identifier: '',
    password: '',
  });
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyCodeSuccess, setCopyCodeSuccess] = useState(false);
  const [expandedPlayerIds, setExpandedPlayerIds] = useState<string[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  const messagesLength = getMessageCount(gameState);

  const scrollToBottom = useCallback((force = false) => {
    if (!chatContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 20;

    if (force || shouldAutoScrollRef.current || isNearBottom) {
      chatContainerRef.current.scrollTo({
        top: scrollHeight,
        behavior: 'smooth'
      });
    }
  }, []);

  useEffect(() => {
    const chatContainer = chatContainerRef.current;
    if (!chatContainer) return;

    const updateAutoScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatContainer;
      shouldAutoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40;
    };

    updateAutoScroll();
    chatContainer.addEventListener('scroll', updateAutoScroll);

    return () => {
      chatContainer.removeEventListener('scroll', updateAutoScroll);
    };
  }, [gameState?.phase]);

  useEffect(() => {
    if (messagesLength <= 0) return;

    const animationFrame = window.requestAnimationFrame(() => {
      scrollToBottom(gameState?.phase === 'lobby');
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [gameState?.phase, messagesLength, scrollToBottom]);

  useEffect(() => {
    if (gameState?.phase === 'lobby') {
      setUserHint('');
      setImposterGuess('');
      setExpandedPlayerIds([]);
      shouldAutoScrollRef.current = true;
    }
  }, [gameState?.phase]);

  const handleSubmitHint = () => {
    if (!userHint.trim()) return;
    submitHint(userHint.trim().split(' ')[0]);
    setUserHint('');
  };

  const handleSendChatMessage = () => {
    sendChatMessage(userHint);
    setUserHint('');
  };

  const handleSubmitImposterGuess = () => {
    if (!imposterGuess.trim()) return;
    submitImposterGuess(imposterGuess.trim());
    setImposterGuess('');
  };

  const updateAuthField = (field: keyof typeof authForm, value: string) => {
    clearAuthError();
    setAuthForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleLogin = async () => {
    const success = await login({
      identifier: authForm.identifier,
      password: authForm.password,
    });

    if (success) {
      setAuthForm(prev => ({
        ...prev,
        password: '',
      }));
    }
  };

  const handleSignup = async () => {
    const success = await signup({
      username: authForm.username,
      email: authForm.email,
      password: authForm.password,
    });

    if (success) {
      setAuthForm(prev => ({
        ...prev,
        password: '',
      }));
    }
  };

  const toggleExpandedPlayer = (playerId: string) => {
    setExpandedPlayerIds(prev =>
      prev.includes(playerId) ? prev.filter(id => id !== playerId) : [...prev, playerId]
    );
  };

  const copyLink = () => {
    copyText(window.location.href);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const copyCode = () => {
    if (!gameState) return;
    copyText(gameState.roomId);
    setCopyCodeSuccess(true);
    setTimeout(() => setCopyCodeSuccess(false), 2000);
  };

  const leaveLobby = () => {
    window.location.href = window.location.pathname;
  };

  if (authStatus === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-slate-900 p-12 rounded-[3rem] shadow-2xl shadow-black/50 max-w-md w-full text-center space-y-8 border border-slate-800"
        >
          <div className="bg-indigo-600 p-6 rounded-3xl inline-block shadow-xl shadow-indigo-500/20">
            <Sword className="w-12 h-12 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase font-display">WORD IMPOSTER</h1>
            <p className="text-slate-500 font-medium text-sm">Create an account or log in to play</p>
          </div>
          <div className="space-y-4">
            {authError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-xs font-bold flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                {authError}
              </motion.div>
            )}
            {authMode === 'signup' ? (
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={authForm.username}
                  onChange={(e) => updateAuthField('username', e.target.value)}
                  placeholder="Username"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-6 py-4 font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-600 transition-all text-center text-lg shadow-inner"
                />
                <input
                  type="email"
                  value={authForm.email}
                  onChange={(e) => updateAuthField('email', e.target.value)}
                  placeholder="Email"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-6 py-4 font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-600 transition-all text-center text-lg shadow-inner"
                />
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(e) => updateAuthField('password', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSignup()}
                  placeholder="Password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-6 py-4 font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-600 transition-all text-center text-lg shadow-inner"
                />
                <button
                  onClick={handleSignup}
                  disabled={isAuthSubmitting}
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-70"
                >
                  {isAuthSubmitting ? 'Creating Account...' : 'Create Account'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  value={authForm.identifier}
                  onChange={(e) => updateAuthField('identifier', e.target.value)}
                  placeholder="Username or Email"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-6 py-4 font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-600 transition-all text-center text-lg shadow-inner"
                />
                <input
                  type="password"
                  value={authForm.password}
                  onChange={(e) => updateAuthField('password', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="Password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-6 py-4 font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-600 transition-all text-center text-lg shadow-inner"
                />
                <button
                  onClick={handleLogin}
                  disabled={isAuthSubmitting}
                  className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/20 disabled:opacity-70"
                >
                  {isAuthSubmitting ? 'Logging In...' : 'Log In'}
                </button>
              </div>
            )}

            <button
              onClick={() => {
                clearAuthError();
                setAuthMode(prev => (prev === 'login' ? 'signup' : 'login'));
              }}
              className="w-full text-slate-400 text-sm font-bold hover:text-white transition-colors"
            >
              {authMode === 'login'
                ? 'Need an account? Create one'
                : 'Already have an account? Log in'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!isJoined) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-slate-900 p-12 rounded-[3rem] shadow-2xl shadow-black/50 max-w-md w-full text-center space-y-8 border border-slate-800"
        >
          <div className="bg-indigo-600 p-6 rounded-3xl inline-block shadow-xl shadow-indigo-500/20">
            <Sword className="w-12 h-12 text-white" />
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase font-display">WORD IMPOSTER</h1>
            <p className="text-slate-500 font-medium text-sm">Signed in as {authUser.username}</p>
          </div>
          <div className="space-y-4">
            {joinError && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-2xl text-xs font-bold flex items-center gap-2"
              >
                <AlertCircle className="w-4 h-4" />
                {joinError}
              </motion.div>
            )}

            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl px-5 py-4 text-left">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Account</p>
              <p className="text-white font-bold text-lg">{authUser.username}</p>
              <p className="text-slate-500 text-sm">{authUser.email}</p>
            </div>

            <div className="h-px w-full bg-slate-800 my-4" />

            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputRoomId}
                  onChange={(e) => setInputRoomId(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && joinGame()}
                  placeholder="Room Code"
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-600 transition-all text-center shadow-inner uppercase"
                />
                <button
                  onClick={joinGame}
                  className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-900/20 whitespace-nowrap"
                >
                  Join
                </button>
              </div>

              <div className="flex items-center gap-4 my-2">
                <div className="flex-1 h-px bg-slate-800" />
                <span className="text-xs font-black text-slate-600 uppercase tracking-widest">OR</span>
                <div className="flex-1 h-px bg-slate-800" />
              </div>

              <button
                onClick={createLobby}
                className="w-full bg-slate-800 border-2 border-slate-700 text-white py-4 rounded-xl font-bold text-lg hover:border-indigo-500 hover:bg-slate-800/80 transition-all shadow-lg"
              >
                Create New Lobby
              </button>

              <button
                onClick={logout}
                className="w-full bg-transparent border border-slate-700 text-slate-300 py-4 rounded-xl font-bold text-sm uppercase tracking-[0.2em] hover:border-slate-500 hover:text-white transition-all"
              >
                Log Out
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-200 selection:bg-indigo-500/30 selection:text-indigo-200 overflow-x-hidden">
      <nav className="border-b border-slate-800 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50 h-20">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl shadow-lg shadow-indigo-600/20">
              <Sword className="w-6 h-6 text-white" />
            </div>
            <span className="font-black text-2xl tracking-tighter uppercase text-white">Word Imposter</span>
          </div>
          {isJoined && authUser && (
            <div className="flex items-center gap-6">
              <div className="hidden md:flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest">
                {authUser.username}
              </div>
              {gameState.phase !== 'lobby' && (
                <div className="hidden sm:flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest">
                  <Users className="w-4 h-4" />
                  {getAlivePlayerCount(gameState)} Alive
                </div>
              )}
              {gameState.phase !== 'lobby' && (
                <div className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest border ${me?.role === 'imposter' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                  me?.role === 'spectator' ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-indigo-600 text-white border-indigo-500/20'
                  }`}>
                  {me?.isEliminated ? 'Eliminated' : me?.role}
                </div>
              )}
              {me?.isHost && gameState.phase !== 'lobby' && (
                <button
                  onClick={resetGame}
                  className="bg-slate-900 hover:bg-slate-800 text-slate-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-800 flex items-center gap-2"
                >
                  <RefreshCw className="w-3 h-3" />
                  Reset to Lobby
                </button>
              )}
              <button
                onClick={logout}
                className="bg-slate-900 hover:bg-slate-800 text-slate-400 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-800 flex items-center gap-2"
              >
                <LogOut className="w-3 h-3" />
                Logout
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-12 px-6">
        <AnimatePresence mode="wait">
          {gameState.phase === 'lobby' && (
            <LobbyScreen
              gameState={gameState}
              me={me}
              socketId={socketId}
              expandedPlayerIds={expandedPlayerIds}
              onTogglePlayer={toggleExpandedPlayer}
              onKickPlayer={kickPlayer}
              onCopyCode={copyCode}
              onCopyLink={copyLink}
              copyCodeSuccess={copyCodeSuccess}
              copySuccess={copySuccess}
              onRequestStartGame={requestStartGame}
              onLeaveLobby={leaveLobby}
              userHint={userHint}
              onUserHintChange={setUserHint}
              onSubmitHint={handleSubmitHint}
              onSendChat={handleSendChatMessage}
              chatContainerRef={chatContainerRef}
            />
          )}
          {(gameState.phase === 'playing' || gameState.phase === 'voting') && (
            <PlayingScreen
              gameState={gameState}
              me={me}
              socketId={socketId}
              isMyTurn={isMyTurn}
              expandedPlayerIds={expandedPlayerIds}
              onTogglePlayer={toggleExpandedPlayer}
              userHint={userHint}
              onUserHintChange={setUserHint}
              onSubmitHint={handleSubmitHint}
              onSendChat={handleSendChatMessage}
              chatContainerRef={chatContainerRef}
              imposterGuess={imposterGuess}
              onImposterGuessChange={setImposterGuess}
              onSubmitImposterGuess={handleSubmitImposterGuess}
              onSubmitVote={submitVote}
            />
          )}
          {gameState.phase === 'gameOver' && (
            <GameOverScreen
              gameState={gameState}
              me={me}
              socketId={socketId}
              onResetGame={resetGame}
            />
          )}
        </AnimatePresence>
      </main>

      <footer className="py-12 text-center text-slate-700 text-[10px] font-black uppercase tracking-[0.4em]">
        <p>&copy;  Shmini's Games &bull; Word Imposter</p>
      </footer>
    </div>
  );
}
