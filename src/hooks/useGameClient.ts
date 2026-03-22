import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { AuthUser, GameState } from '../types';
import { getPlayerById, isCurrentTurn } from '../utils/gameSelectors';
import {
  clearRoomQuery,
  createRoomId,
  getInitialRoomId,
  setRoomQuery,
} from '../utils/roomSession';

type LoginPayload = {
  identifier: string;
  password: string;
};

type SignupPayload = {
  username: string;
  email: string;
  password: string;
};

type AuthResponse = {
  user: AuthUser | null;
  error?: string;
};

async function requestAuth(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(endpoint, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return { user: null } satisfies AuthResponse;
  }

  const data = (await response.json().catch(() => ({}))) as Partial<AuthResponse>;
  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : 'Request failed.');
  }

  return {
    user: data.user ?? null,
  } satisfies AuthResponse;
}

export function useGameClient() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authStatus, setAuthStatus] = useState<'loading' | 'ready'>('loading');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [inputRoomId, setInputRoomId] = useState(getInitialRoomId);
  const [isJoined, setIsJoined] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const activeRoomIdRef = useRef(inputRoomId);

  const me = getPlayerById(gameState, socket?.id);
  const isMyTurn = isCurrentTurn(gameState, socket?.id);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      try {
        const response = await requestAuth('/api/auth/session');
        if (isMounted) {
          setAuthUser(response.user);
          setAuthError(null);
        }
      } catch (error) {
        if (isMounted) {
          setAuthError(error instanceof Error ? error.message : 'Unable to load session.');
        }
      } finally {
        if (isMounted) {
          setAuthStatus('ready');
        }
      }
    };

    loadSession();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!authUser) {
      setSocket(currentSocket => {
        currentSocket?.close();
        return null;
      });
      setGameState(null);
      setIsJoined(false);
      setJoinError(null);
      activeRoomIdRef.current = '';
      return;
    }

    const newSocket = io();
    setSocket(newSocket);
    setGameState(null);
    setIsJoined(false);
    setJoinError(null);

    newSocket.on('stateUpdate', (state: GameState) => {
      setGameState(state);
      setJoinError(null);
      setIsJoined(true);
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
      setSocket(currentSocket => (currentSocket === newSocket ? null : currentSocket));
    };
  }, [authUser?.id]);

  const login = async (payload: LoginPayload) => {
    setIsAuthSubmitting(true);
    setAuthError(null);

    try {
      const response = await requestAuth('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAuthUser(response.user);
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to log in.');
      return false;
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const signup = async (payload: SignupPayload) => {
    setIsAuthSubmitting(true);
    setAuthError(null);

    try {
      const response = await requestAuth('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAuthUser(response.user);
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign up.');
      return false;
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const logout = async () => {
    setAuthError(null);

    try {
      await requestAuth('/api/auth/logout', { method: 'POST' });
    } finally {
      setAuthUser(null);
      setGameState(null);
      setIsJoined(false);
      setJoinError(null);
      setInputRoomId('');
      activeRoomIdRef.current = '';
      clearRoomQuery();
    }
  };

  const joinGame = () => {
    if (!authUser) {
      setJoinError('You must be logged in to join a room.');
      return;
    }
    if (!inputRoomId.trim()) {
      setJoinError('Enter a room code to join.');
      return;
    }
    if (!socket) {
      setJoinError('Connecting to game server. Try again in a moment.');
      return;
    }

    setJoinError(null);
    const roomId = inputRoomId.trim();
    activeRoomIdRef.current = roomId;
    setRoomQuery(roomId);
    socket.emit('joinRoom', { roomId });
    setIsJoined(true);
  };

  const createLobby = () => {
    if (!authUser) {
      setJoinError('You must be logged in to create a room.');
      return;
    }
    if (!socket) {
      setJoinError('Connecting to game server. Try again in a moment.');
      return;
    }

    setJoinError(null);
    const roomId = createRoomId();
    activeRoomIdRef.current = roomId;
    setInputRoomId(roomId);
    setRoomQuery(roomId);
    socket.emit('joinRoom', { roomId });
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
    authError,
    authStatus,
    authUser,
    clearAuthError: () => setAuthError(null),
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
    socketId: socket?.id,
    signup,
    submitHint,
    submitImposterGuess,
    submitVote,
  };
}
