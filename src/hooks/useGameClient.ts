import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { GameState } from '../types';
import { getPlayerById, isCurrentTurn } from '../utils/gameSelectors';
import {
  clearRoomQuery,
  createRoomId,
  getInitialRoomId,
  getStoredPlayerName,
  setRoomQuery,
  storePlayerName,
} from '../utils/roomSession';

export function useGameClient() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playerName, setPlayerName] = useState(getStoredPlayerName);
  const [inputRoomId, setInputRoomId] = useState(getInitialRoomId);
  const [isJoined, setIsJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const activeRoomIdRef = useRef(inputRoomId);

  const me = getPlayerById(gameState, socket?.id);
  const isMyTurn = isCurrentTurn(gameState, socket?.id);

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
      clearRoomQuery();
    });

    return () => {
      newSocket.close();
    };
  }, []);

  const joinGame = () => {
    if (!playerName.trim() || !socket || !inputRoomId.trim()) return;
    setJoinError(null);
    const roomId = inputRoomId.trim();
    activeRoomIdRef.current = roomId;
    setRoomQuery(roomId);
    storePlayerName(playerName);
    socket.emit('joinRoom', { roomId, playerName });
    setIsJoined(true);
  };

  const createLobby = () => {
    if (!playerName.trim() || !socket) return;
    setJoinError(null);
    const roomId = createRoomId();
    activeRoomIdRef.current = roomId;
    setInputRoomId(roomId);
    setRoomQuery(roomId);
    storePlayerName(playerName);
    socket.emit('joinRoom', { roomId, playerName });
    setIsJoined(true);
  };

  const sendChatMessage = (text: string) => {
    socket?.emit('chatMessage', { roomId: activeRoomIdRef.current, text });
  };

  const requestStartGame = () => {
    socket?.emit('requestStartGame', { roomId: activeRoomIdRef.current });
  };

  const submitHint = (hint: string) => {
    socket?.emit('submitHint', { roomId: activeRoomIdRef.current, hint });
  };

  const submitVote = (voteId: string) => {
    socket?.emit('submitVote', { roomId: activeRoomIdRef.current, votedId: voteId });
  };

  const submitImposterGuess = (guess: string) => {
    socket?.emit('submitImposterGuess', { roomId: activeRoomIdRef.current, guess });
  };

  const resetGame = () => {
    if (!me?.isHost) return;
    socket?.emit('resetGame', { roomId: activeRoomIdRef.current });
  };

  const kickPlayer = (playerId: string) => {
    if (!me?.isHost) return;
    socket?.emit('kickPlayer', { roomId: activeRoomIdRef.current, playerId });
  };

  return {
    createLobby,
    gameState,
    inputRoomId,
    isJoined,
    isMyTurn,
    joinError,
    joinGame,
    kickPlayer,
    me,
    playerName,
    requestStartGame,
    resetGame,
    sendChatMessage,
    setInputRoomId,
    setPlayerName,
    socketId: socket?.id,
    submitHint,
    submitImposterGuess,
    submitVote,
  };
}
