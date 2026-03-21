import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  User,
  Sword,
  Shield,
  MessageSquare,
  Vote,
  Trophy,
  AlertCircle,
  RefreshCw,
  Play,
  CheckCircle2,
  XCircle,
  Link as LinkIcon,
  Copy,
  Clock,
  ChevronDown,
  LogOut
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { GoogleGenAI, Type } from "@google/genai";
import { Player, GameState } from './types';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export default function App() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('playerName') || '');
  const [isJoined, setIsJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [userHint, setUserHint] = useState('');
  const [imposterGuess, setImposterGuess] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [copyCodeSuccess, setCopyCodeSuccess] = useState(false);
  const [expandedPlayerIds, setExpandedPlayerIds] = useState<string[]>([]);
  const chatEndRef = React.useRef<HTMLDivElement>(null);
  const chatContainerRef = React.useRef<HTMLDivElement>(null);

  const me = gameState?.players.find(p => p.id === socket?.id);
  const isMyTurn = gameState?.currentTurnPlayerId === socket?.id;

  const messagesLength = gameState?.messages.length || 0;

  const scrollToBottom = useCallback((force = false) => {
    if (!chatContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
    // If we are within 20px of the bottom, we auto-scroll
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 20;

    if (force || isNearBottom) {
      chatContainerRef.current.scrollTo({
        top: scrollHeight,
        behavior: "smooth"
      });
    }
  }, []);

  useEffect(() => {
    if (messagesLength > 0) {
      scrollToBottom();
    }
  }, [messagesLength, scrollToBottom]);

  const [inputRoomId, setInputRoomId] = useState(() => new URLSearchParams(window.location.search).get('room') || '');
  const activeRoomIdRef = React.useRef(inputRoomId);

  useEffect(() => {
    const newSocket = io();
    setSocket(newSocket);

    newSocket.on('stateUpdate', (state: GameState) => {
      setGameState(state);
      setJoinError(null);
    });

    newSocket.on('joinError', (error: string) => {
      setJoinError(error);
      setIsJoined(false);
    });

    newSocket.on('kicked', () => {
      setIsJoined(false);
      setGameState(null);
      setJoinError('You have been kicked from the lobby.');
      window.history.replaceState({}, '', window.location.pathname);
    });

    newSocket.on('requestWords', async () => {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: "Generate a pair of related but distinct words for a game of 'Word Imposter'. One is the 'Secret Word' for normal players, and the other is the 'Imposter Word' for the imposter. They should be in the same category (e.g., 'Apple' and 'Pear'). Return as JSON.",
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                secretWord: { type: Type.STRING },
                imposterWord: { type: Type.STRING },
              },
              required: ["secretWord", "imposterWord"],
            },
          },
        });

        const words = JSON.parse(response.text || "{}");
        if (words.secretWord && words.imposterWord) {
          newSocket.emit('startGame', {
            roomId: activeRoomIdRef.current,
            secretWord: words.secretWord,
            imposterWord: words.imposterWord
          });
        }
      } catch (error) {
        console.error("Failed to generate words:", error);
        // Fallback words
        newSocket.emit('startGame', {
          roomId: activeRoomIdRef.current,
          secretWord: "Apple",
          imposterWord: "Pear"
        });
      }
    });

    newSocket.on('validateImposterGuess', async ({ guess, secretWord }) => {
      // Basic check first to avoid API call if it's exactly the same
      if (guess.trim().toLowerCase() === secretWord.toLowerCase()) {
        newSocket.emit('imposterGuessResult', { roomId: activeRoomIdRef.current, isCorrect: true });
        return;
      }
      
      // Only the host should reach here, and they'll have the secretWord sent by the server for this check
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Is the word "${guess.toLowerCase()}" semantically the same as or a very close synonym of "${secretWord.toLowerCase()}" in the context of a guessing game? Answer with a JSON object containing a boolean field "isCorrect".`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isCorrect: { type: Type.BOOLEAN }
              },
              required: ["isCorrect"]
            }
          }
        });
        const result = JSON.parse(response.text || "{}");
        newSocket.emit('imposterGuessResult', { roomId: activeRoomIdRef.current, isCorrect: !!result.isCorrect });
      } catch (error) {
        console.error("Failed to validate guess:", error);
        newSocket.emit('imposterGuessResult', { roomId: activeRoomIdRef.current, isCorrect: false });
      }
    });

    return () => {
      newSocket.close();
    };
  }, []);

  useEffect(() => {
    if (gameState?.phase === 'lobby') {
      setUserHint('');
      setImposterGuess('');
      setExpandedPlayerIds([]);
    }
  }, [gameState?.phase]);

  const joinGame = () => {
    if (!playerName.trim() || !socket || !inputRoomId.trim()) return;
    setJoinError(null);
    const id = inputRoomId.trim();
    activeRoomIdRef.current = id;
    window.history.replaceState({}, '', `?room=${id}`);
    localStorage.setItem('playerName', playerName);
    socket.emit('joinRoom', { roomId: id, playerName });
    setIsJoined(true);
  };

  const createLobby = () => {
    if (!playerName.trim() || !socket) return;
    setJoinError(null);
    const newId = Math.random().toString(36).substring(2, 9);
    activeRoomIdRef.current = newId;
    setInputRoomId(newId);
    window.history.replaceState({}, '', `?room=${newId}`);
    localStorage.setItem('playerName', playerName);
    socket.emit('joinRoom', { roomId: newId, playerName });
    setIsJoined(true);
  };

  const setReady = () => {
    socket?.emit('setReady', { roomId: activeRoomIdRef.current });
  };

  const requestStartGame = () => {
    socket?.emit('requestStartGame', { roomId: activeRoomIdRef.current });
  };

  const submitHint = () => {
    if (!userHint.trim()) return;
    socket?.emit('submitHint', { roomId: activeRoomIdRef.current, hint: userHint.trim().split(' ')[0] });
    setUserHint('');
  };

  const submitVote = (votedId: string) => {
    socket?.emit('submitVote', { roomId: activeRoomIdRef.current, votedId });
  };

  const submitImposterGuess = () => {
    if (!imposterGuess.trim()) return;
    socket?.emit('submitImposterGuess', { roomId: activeRoomIdRef.current, guess: imposterGuess.trim() });
    setImposterGuess('');
  };

  const resetGame = () => {
    if (!me?.isHost) return;
    socket?.emit('resetGame', { roomId: activeRoomIdRef.current });
  };

  const kickPlayer = (playerId: string) => {
    if (!me?.isHost) return;
    socket?.emit('kickPlayer', { roomId: activeRoomIdRef.current, playerId });
  };

  const copyLink = () => {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(window.location.href);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = window.location.href;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Failed to copy', err);
      }
      document.body.removeChild(textArea);
    }
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const copyCode = () => {
    if (!gameState) return;
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(gameState.roomId);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = gameState.roomId;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
      } catch (err) {
        console.error('Failed to copy', err);
      }
      document.body.removeChild(textArea);
    }
    setCopyCodeSuccess(true);
    setTimeout(() => setCopyCodeSuccess(false), 2000);
  };

  const renderChatSection = (height = "600px") => {
    if (!gameState) return null;
    const isPlaying = gameState.phase === 'playing';
    const isSpectator = me?.role === 'spectator' || me?.isEliminated;

    return (
      <div className={`bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl border border-slate-800 flex flex-col`} style={{ height }}>
        <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-indigo-500" />
          {isPlaying ? "Game Log & Hints" : "Lobby Chat"}
        </h3>
        <div
          ref={chatContainerRef}
          className="flex-1 space-y-4 overflow-y-auto pr-2 custom-scrollbar min-h-0"
        >
          <AnimatePresence mode="popLayout">
            {gameState.messages.map((msg) => {
              const isMe = msg.playerId === socket?.id;
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
              onChange={(e) => setUserHint(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  if (isPlaying) {
                    submitHint();
                  } else {
                    socket?.emit('chatMessage', { roomId: activeRoomIdRef.current, text: userHint });
                    setUserHint('');
                  }
                }
              }}
              placeholder={isPlaying ? "Enter a 1-word hint..." : "Type a message..."}
              className="flex-1 bg-slate-800 border-2 border-slate-700 rounded-2xl px-6 py-4 font-bold text-white focus:outline-none focus:border-indigo-600 transition-all text-base"
            />
            <button
              onClick={() => {
                if (isPlaying) submitHint();
                else {
                  socket?.emit('chatMessage', { roomId: activeRoomIdRef.current, text: userHint });
                  setUserHint('');
                }
              }}
              className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-base hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-900/20"
            >
              Send
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderVotingSection = (height = "700px") => {
    if (!gameState) return null;
    const activeVoters = gameState.players.filter(p => !p.isEliminated && p.role !== 'spectator');
    const votedCount = Object.keys(gameState.lastVoteResults || {}).length;
    const isSpectator = me?.role === 'spectator' || me?.isEliminated;

    return (
      <div className={`bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl border border-slate-800 flex flex-col`} style={{ height }}>
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
            {gameState.players.filter(p => p.role !== 'spectator').map(p => {
              const hasVoted = !!gameState.lastVoteResults[socket?.id || ''];
              const isMe = p.id === socket?.id;
              const isVotedByMe = gameState.lastVoteResults[socket?.id || ''] === p.id;

              return (
                <motion.button
                  key={p.id}
                  whileHover={!isSpectator && !hasVoted && !isMe && !p.isEliminated ? { scale: 1.02 } : {}}
                  whileTap={!isSpectator && !hasVoted && !isMe && !p.isEliminated ? { scale: 0.98 } : {}}
                  onClick={() => submitVote(p.id)}
                  disabled={isSpectator || hasVoted || isMe || p.isEliminated}
                  className={`group relative p-6 rounded-3xl border-2 transition-all flex items-center gap-4 text-left ${isMe || isSpectator || hasVoted || p.isEliminated
                    ? `opacity-50 cursor-not-allowed ${isVotedByMe ? 'border-indigo-500 bg-indigo-500/5' : 'border-slate-800 bg-slate-900/50'}`
                    : 'border-slate-800 bg-slate-900 hover:border-indigo-500 hover:bg-indigo-500/5 shadow-xl'
                    }`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 transition-all ${isVotedByMe ? 'bg-indigo-500 text-white' :
                    isMe || p.isEliminated ? 'bg-slate-800 text-slate-600' : 'bg-slate-800 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white'
                    }`}>
                    <User className="w-6 h-6" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className={`font-black text-lg tracking-tight truncate ${p.isEliminated ? 'text-slate-600 line-through' : 'text-white'}`}>
                      {p.name}
                      {isMe && <span className="text-[10px] text-slate-500 ml-2">(You)</span>}
                    </div>
                    {!p.isEliminated && (
                      <div className="text-[10px] font-bold text-slate-400 italic truncate">
                        "{p.hints[p.hints.length - 1] || 'No hint yet'}"
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
            {isSpectator ? "Waiting for players to vote..." : (!!gameState.lastVoteResults[socket?.id || ''] ? "Vote cast! Waiting for others..." : "Select a player to vote for them as the imposter.")}
          </p>
        </div>
      </div>
    );
  };

  const renderPlayerList = () => {
    if (!gameState) return null;
    const isPlaying = gameState.phase !== 'lobby';

    return (
      <div className="space-y-4">
        {gameState.players.map(p => {
          const isExpanded = expandedPlayerIds.includes(p.id);
          const isCurrentTurn = gameState.currentTurnPlayerId === p.id;

          return (
            <div key={p.id} className="space-y-2">
              <motion.div
                layout
                onClick={() => setExpandedPlayerIds(prev =>
                  isExpanded ? prev.filter(id => id !== p.id) : [...prev, p.id]
                )}
                animate={{
                  scale: isCurrentTurn && isPlaying ? 1.02 : 1,
                  backgroundColor: isCurrentTurn && isPlaying ? 'rgba(99, 102, 241, 0.15)' : 'rgba(30, 41, 59, 0.5)'
                }}
                className={`flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${p.isEliminated ? 'opacity-40 grayscale border-transparent' :
                  isCurrentTurn && isPlaying ? 'border-indigo-600 shadow-lg shadow-indigo-500/10' : 'border-slate-800 hover:border-slate-700'
                  }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${p.id === socket?.id ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-500'}`}>
                  <User className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-black text-slate-200 flex items-center gap-2 min-w-0">
                    <span className="truncate">{p.name}</span>
                    {p.id === socket?.id && <span className="text-[9px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-400 shrink-0">YOU</span>}
                  </div>
                  {p.role === 'spectator' && <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Spectating</div>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {(p.isHost || (isCurrentTurn && !p.isEliminated && isPlaying)) && (
                    <div className="flex items-center gap-2 bg-slate-950/60 px-2 py-1 rounded-xl border border-slate-800/50">
                      {p.isHost && (
                        <span className="text-[9px] bg-indigo-600/20 text-indigo-400 px-2 py-0.5 rounded-md uppercase tracking-widest font-black border border-indigo-500/20">
                          Host
                        </span>
                      )}
                      {isCurrentTurn && !p.isEliminated && isPlaying && (
                        <span className={`font-black text-[11px] tabular-nums ${gameState.timer < 5 ? 'text-red-500 animate-pulse' : 'text-indigo-400'}`}>
                          {gameState.timer}s
                        </span>
                      )}
                    </div>
                  )}
                  {p.isEliminated && <XCircle className="w-5 h-5 text-red-500" />}
                  {me?.isHost && p.id !== socket?.id && !isPlaying && (
                    <button
                      onClick={(e) => { e.stopPropagation(); kickPlayer(p.id); }}
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
                      {p.hints.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {p.hints.map((h, i) => (
                            <div key={i} className="flex items-center justify-between bg-slate-800/80 px-3 py-2 rounded-xl text-xs border border-slate-700/50">
                              <span className="text-slate-500 font-black uppercase text-[9px]">Round {i + 1}</span>
                              <span className="text-slate-200 font-bold">{h}</span>
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
  };

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
            <p className="text-slate-500 font-medium text-sm">Join the game to start playing</p>
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
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Your Name"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-6 py-4 font-bold text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-600 transition-all text-center text-lg shadow-inner"
            />
            
            <div className="h-px w-full bg-slate-800 my-4" />

            <div className="flex flex-col gap-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputRoomId}
                  onChange={(e) => setInputRoomId(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && joinGame()}
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
            </div>
          </div>
        </motion.div>
      </div>
    );
  };


  if (!gameState) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <RefreshCw className="w-12 h-12 text-indigo-600 animate-spin" />
      </div>
    );
  }

  const renderTimer = () => {
    if (gameState.timer <= 0) return null;
    const percentage = (gameState.timer / gameState.maxTimer) * 100;

    return (
      <div className="fixed top-24 left-1/2 -translate-x-1/2 w-full max-w-md px-6 z-40">
        <div className="bg-slate-900/80 backdrop-blur-md border border-slate-800 rounded-full p-2 shadow-2xl flex items-center gap-4">
          <div className="bg-indigo-600 p-2 rounded-full">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 h-3 bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 1, ease: "linear" }}
              className={`h-full ${gameState.timer < 5 ? 'bg-red-500' : 'bg-indigo-600'}`}
            />
          </div>
          <span className={`font-black text-xl tabular-nums w-8 ${gameState.timer < 5 ? 'text-red-500 animate-pulse' : 'text-slate-300'}`}>
            {gameState.timer}
          </span>
        </div>
      </div>
    );
  };

  const renderLobby = () => {
    return (
      <div className="flex flex-col gap-8 max-w-6xl mx-auto w-full font-sans">
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-slate-900 rounded-[2rem] p-8 shadow-2xl border border-slate-800 space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Player List</h3>
                <div className="bg-slate-800 px-3 py-1 rounded-lg text-[10px] font-bold text-slate-400 border border-slate-700 uppercase tracking-widest">
                  {gameState.players.filter(p => p.isReady).length}/{gameState.players.length} Ready
                </div>
              </div>
              {renderPlayerList()}
            </div>

            <div className="bg-slate-900 rounded-[2rem] p-8 shadow-2xl border border-slate-800 space-y-6">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">Invite Friends</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-center gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <span className="text-sm font-black text-slate-500 uppercase tracking-[0.2em]">Room Code:</span>
                  <span className="text-2xl font-black font-mono text-indigo-400 tracking-widest uppercase mt-0.5">
                    {gameState.roomId}
                  </span>
                  <button
                    onClick={copyCode}
                    className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-indigo-400 hover:text-white transition-all shadow-sm flex items-center justify-center ml-2"
                    title="Copy Room Code"
                  >
                    {copyCodeSuccess ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
                <button
                  onClick={copyLink}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-xl font-bold transition-all border border-slate-700"
                >
                  {copySuccess ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <LinkIcon className="w-4 h-4" />}
                  {copySuccess ? "Link Copied!" : "Copy Invite Link"}
                </button>
              </div>
            </div>

            {me?.isHost ? (
              <button
                onClick={requestStartGame}
                disabled={gameState.players.filter(p => p.role === 'player').length < 3}
                className={`w-full py-6 rounded-2xl font-black text-xl transition-all shadow-xl flex items-center justify-center gap-3 ${gameState.players.filter(p => p.role === 'player').length < 3
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

            {me?.isHost && gameState.players.filter(p => p.role === 'player').length < 3 && (
              <p className="text-center text-slate-600 text-xs font-medium italic">
                Need at least 3 players to start...
              </p>
            )}

            <button
              onClick={() => window.location.href = window.location.pathname}
              className="w-full py-4 rounded-xl font-bold text-red-500 hover:text-white bg-slate-900 hover:bg-red-600 border border-slate-800 hover:border-red-500 transition-all shadow-lg flex items-center justify-center gap-2"
            >
              <LogOut className="w-5 h-5" />
              Leave Lobby
            </button>
          </div>

          <div className="lg:col-span-2">
            {renderChatSection("700px")}
          </div>
        </div>
      </div>
    );
  };

  const renderPlaying = () => {
    const currentPlayer = gameState?.players.find(p => p.id === gameState.currentTurnPlayerId);
    const isSpectator = me?.role === 'spectator' || me?.isEliminated;
    const isVoting = gameState?.phase === 'voting';

    return (
      <div className="max-w-6xl mx-auto space-y-12 py-8 px-4 relative">
        <div className="flex flex-col sm:flex-row justify-between items-center bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl border border-slate-800 gap-6">
          <div className="space-y-1 text-center sm:text-left">
            <span className="text-xs font-black text-slate-500 uppercase tracking-[0.2em]">
              {isVoting ? "VOTING PHASE" : `Round ${gameState.round}`}
            </span>
            <h2 className="text-3xl font-black text-white flex items-center gap-3 justify-center sm:justify-start">
              {isVoting ? "Who is the Imposter?" : (isMyTurn ? "Your Turn" : `${currentPlayer?.name}'s Turn`)}
              {!isVoting && isMyTurn && <div className="w-3 h-3 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />}
            </h2>
          </div>
          <div className="bg-slate-950/50 p-4 px-8 rounded-3xl border border-slate-800 flex flex-col items-center sm:items-end gap-1">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Your Word</span>
            <div className="text-3xl font-black text-indigo-400 tracking-tight">
              {isSpectator ? "SPECTATING" : (me?.role === 'imposter' ? gameState.imposterWord : gameState.secretWord)}
            </div>
            {me?.role === 'imposter' && !isSpectator && (
              <span className="text-[9px] font-black text-red-500 uppercase tracking-widest block mt-1">You are the Imposter</span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl border border-slate-800">
              <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-6">Players</h3>
              {renderPlayerList()}
            </div>

            {me?.role === 'imposter' && !isSpectator && !isVoting && (
              <div className="bg-red-500/10 rounded-[2.5rem] p-8 border border-red-500/20 space-y-6">
                <div className="flex items-center gap-2 text-red-500 font-black text-xs uppercase tracking-[0.2em]">
                  <AlertCircle className="w-4 h-4" />
                  Imposter Action
                </div>
                <p className="text-xs text-red-400 font-bold leading-relaxed">
                  Guess the secret word to win instantly. Use this wisely!
                </p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Guesses left</span>
                    <span className="text-[10px] text-red-400 font-black">{gameState.imposterGuesses} / 3</span>
                  </div>
                  <input
                    type="text"
                    value={imposterGuess}
                    onChange={(e) => setImposterGuess(e.target.value.toUpperCase())}
                    placeholder="Guess the word..."
                    className="w-full bg-slate-800 border-2 border-red-500/20 rounded-2xl px-5 py-3 text-sm font-black text-white focus:outline-none focus:border-red-500 uppercase"
                  />
                  <button
                    onClick={submitImposterGuess}
                    className="w-full bg-red-600 text-white py-4 rounded-2xl text-sm font-black hover:bg-red-700 transition-all shadow-lg shadow-red-900/20"
                  >
                    Guess & Win
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              {isVoting ? (
                <motion.div
                  key="voting-section"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.3 }}
                >
                  {renderVotingSection("700px")}
                </motion.div>
              ) : (
                <motion.div
                  key="chat-section"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.3 }}
                >
                  {renderChatSection("700px")}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    );
  };

  const renderGameOver = () => {
    const isWin = (gameState.winner === 'players' && me?.role === 'player') ||
      (gameState.winner === 'imposter' && me?.role === 'imposter');

    const imposter = gameState.players.find(p => p.role === 'imposter')!;

    return (
      <div className="max-w-3xl mx-auto py-12 px-4 text-center space-y-16">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="space-y-8"
        >
          <div className={`w-40 h-40 rounded-full flex items-center justify-center mx-auto shadow-2xl ${isWin ? 'bg-emerald-500/10 shadow-emerald-500/10' : 'bg-red-500/10 shadow-red-500/10'}`}>
            <Trophy className={`w-20 h-20 ${isWin ? 'text-emerald-500' : 'text-red-500'}`} />
          </div>
          <div className="space-y-2">
            <h2 className="text-7xl font-black text-white tracking-tighter uppercase">
              {gameState.winner === 'players' ? "Players Win!" : "Imposter Wins!"}
            </h2>
            <p className="text-3xl text-slate-400 font-bold">
              {isWin ? "Victory is yours!" : "Defeat. Try again?"}
            </p>
          </div>
        </motion.div>

        <div className="bg-slate-900 rounded-[3rem] p-12 shadow-2xl border border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-12 relative overflow-hidden">
          <div className="space-y-3">
            <span className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Secret Word</span>
            <div className="text-4xl font-black text-indigo-500 uppercase tracking-tight">{gameState.secretWord}</div>
          </div>
          <div className="space-y-3">
            <span className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">Imposter Word</span>
            <div className="text-4xl font-black text-red-500 uppercase tracking-tight">{gameState.imposterWord}</div>
          </div>
          <div className="col-span-1 sm:col-span-2 pt-8 border-t border-slate-800">
            <span className="text-xs font-black text-slate-500 uppercase tracking-[0.3em]">The Imposter was</span>
            <div className="text-2xl font-black text-slate-200 mt-2">{imposter.name} {imposter.id === socket?.id ? "(You)" : ""}</div>
          </div>
        </div>

        {me?.isHost && (
          <button
            onClick={resetGame}
            className="bg-indigo-600 text-white px-16 py-6 rounded-[2rem] font-black text-2xl hover:bg-indigo-700 transition-all shadow-2xl shadow-indigo-900/20 flex items-center gap-4 mx-auto"
          >
            <RefreshCw className="w-8 h-8" />
            Play Again
          </button>
        )}
        {!me?.isHost && (
          <div className="text-slate-500 font-black text-xl animate-pulse">
            Waiting for host to start a new game...
          </div>
        )}
      </div>
    );
  };

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
          {isJoined && (
            <div className="flex items-center gap-6">
              {gameState.phase !== 'lobby' && (
                <div className="hidden sm:flex items-center gap-2 text-slate-500 font-black text-[10px] uppercase tracking-widest">
                  <Users className="w-4 h-4" />
                  {gameState.players.filter(p => !p.isEliminated && p.role !== 'spectator').length} Alive
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
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-12 px-6">
        <AnimatePresence mode="wait">
          {gameState.phase === 'lobby' && renderLobby()}
          {(gameState.phase === 'playing' || gameState.phase === 'voting') && renderPlaying()}
          {gameState.phase === 'gameOver' && renderGameOver()}
        </AnimatePresence>
      </main>

      <footer className="py-12 text-center text-slate-700 text-[10px] font-black uppercase tracking-[0.4em]">
        <p>&copy;  Shmini's Games &bull; Word Imposter</p>
      </footer>
    </div>
  );
}
