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

const DEV_SESSION_HEADER_NAME = 'x-word-imposter-dev-session';
const DEV_SESSION_STORAGE_KEY = 'wordImposterDevSessionToken';

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
  devSessionToken?: string;
};

function getStoredDevSessionToken() {
  if (!import.meta.env.DEV) {
    return null;
  }

  const token = window.sessionStorage.getItem(DEV_SESSION_STORAGE_KEY);
  return token?.trim() ? token : null;
}

function storeDevSessionToken(token: string) {
  if (!import.meta.env.DEV) {
    return;
  }

  window.sessionStorage.setItem(DEV_SESSION_STORAGE_KEY, token);
}

function clearStoredDevSessionToken() {
  if (!import.meta.env.DEV) {
    return;
  }

  window.sessionStorage.removeItem(DEV_SESSION_STORAGE_KEY);
}

async function requestAuth(
  endpoint: string,
  options: RequestInit & { devSessionToken?: string | null } = {}
) {
  const { devSessionToken, ...fetchOptions } = options;
  const response = await fetch(endpoint, {
    credentials: 'same-origin',
    ...fetchOptions,
    headers: {
      ...(fetchOptions.body ? { 'Content-Type': 'application/json' } : {}),
      ...(devSessionToken ? { [DEV_SESSION_HEADER_NAME]: devSessionToken } : {}),
      ...(fetchOptions.headers ?? {}),
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
    devSessionToken: typeof data.devSessionToken === 'string' ? data.devSessionToken : undefined,
  } satisfies AuthResponse;
}

export function useGameClient() {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [devSessionToken, setDevSessionToken] = useState<string | null>(() => getStoredDevSessionToken());
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
        const response = await requestAuth('/api/auth/session', { devSessionToken });
        if (isMounted) {
          setAuthUser(response.user);
          setAuthError(null);
          if (!response.user && devSessionToken) {
            clearStoredDevSessionToken();
            setDevSessionToken(null);
          }
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
  }, [devSessionToken]);

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

    const newSocket = io({
      auth: devSessionToken ? { devSessionToken } : undefined,
    });
    setSocket(newSocket);
    setGameState(null);
    setIsJoined(false);
    setJoinError(null);

    newSocket.on('connect', () => {
      setJoinError(null);
    });

    newSocket.on('connect_error', (error) => {
      setGameState(null);
      setIsJoined(false);
      setJoinError(error.message || 'Unable to connect to the game server.');
    });

    newSocket.on('disconnect', (reason) => {
      if (reason === 'io client disconnect') {
        return;
      }

      setIsJoined(false);
      setGameState(null);
      setJoinError('Connection to the game server was lost. Please try again.');
    });

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
  }, [authUser?.id, devSessionToken]);

  const login = async (payload: LoginPayload) => {
    setIsAuthSubmitting(true);
    setAuthError(null);

    try {
      const response = await requestAuth('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
        devSessionToken,
      });
      clearStoredDevSessionToken();
      setDevSessionToken(null);
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
        devSessionToken,
      });
      clearStoredDevSessionToken();
      setDevSessionToken(null);
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
      await requestAuth('/api/auth/logout', { method: 'POST', devSessionToken });
    } finally {
      clearStoredDevSessionToken();
      setDevSessionToken(null);
      setAuthUser(null);
      setGameState(null);
      setIsJoined(false);
      setJoinError(null);
      setInputRoomId('');
      activeRoomIdRef.current = '';
      clearRoomQuery();
    }
  };

  const devLogin = async (slot: number) => {
    if (!import.meta.env.DEV) {
      return false;
    }

    setIsAuthSubmitting(true);
    setAuthError(null);

    try {
      const response = await requestAuth('/api/dev/login-as', {
        method: 'POST',
        body: JSON.stringify({ slot }),
      });

      if (!response.user || !response.devSessionToken) {
        throw new Error('Unable to start a dev session.');
      }

      storeDevSessionToken(response.devSessionToken);
      setDevSessionToken(response.devSessionToken);
      setAuthUser(response.user);
      return true;
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to start a dev session.');
      return false;
    } finally {
      setIsAuthSubmitting(false);
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
    if (!socket || !socket.connected) {
      setJoinError('Connecting to game server. Try again in a moment.');
      return;
    }

    setJoinError(null);
    const roomId = inputRoomId.trim();
    activeRoomIdRef.current = roomId;
    setRoomQuery(roomId);
    socket.emit('joinRoom', { roomId });
  };

  const createLobby = () => {
    if (!authUser) {
      setJoinError('You must be logged in to create a room.');
      return;
    }
    if (!socket || !socket.connected) {
      setJoinError('Connecting to game server. Try again in a moment.');
      return;
    }

    setJoinError(null);
    const roomId = createRoomId();
    activeRoomIdRef.current = roomId;
    setInputRoomId(roomId);
    setRoomQuery(roomId);
    socket.emit('joinRoom', { roomId });
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
    devLogin,
    gameState,
    inputRoomId,
    isAuthSubmitting,
    isJoined,
    isMyTurn,
    isDevelopment: import.meta.env.DEV,
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
