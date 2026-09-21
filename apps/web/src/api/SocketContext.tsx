import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './client';
import { useAuth } from '../features/auth/AuthContext';

export interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  setActiveConversation: (conversationId: string | null) => void;
  on: <T,>(event: string, callback: (data: T) => void) => void;
  off: (event: string, callback?: (...args: unknown[]) => void) => void;
  emit: (event: string, data?: unknown) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const activeConversationRef = useRef<string | null>(null);

  // Subscriptions registered via `on()` are kept here as the source of
  // truth, not just attached to the current socket. React runs a child's
  // effects before its parent's in the same commit, so a chat component
  // that calls `on('message:new', ...)` on mount can run BEFORE this
  // provider's own effect has created the socket - without this registry,
  // that subscription would silently attach to nothing and be lost. Any
  // (re)created socket instance replays every registered listener.
  const listenersRef = useRef<Map<string, Set<(...args: unknown[]) => void>>>(
    new Map()
  );

  const setActiveConversation = useCallback((conversationId: string | null) => {
    activeConversationRef.current = conversationId;

    // If socket is connected and we have an active conversation, join it
    if (socketRef.current?.connected && conversationId) {
      socketRef.current.emit('conversation:join', { conversationId });
    }
  }, []);

  const on = useCallback(
    <T,>(event: string, callback: (data: T) => void) => {
      const cb = callback as (...args: unknown[]) => void;
      let set = listenersRef.current.get(event);
      if (!set) {
        set = new Set();
        listenersRef.current.set(event, set);
      }
      set.add(cb);
      socketRef.current?.on(event, cb);
    },
    []
  );

  const off = useCallback((event: string, callback?: (...args: unknown[]) => void) => {
    if (callback) {
      listenersRef.current.get(event)?.delete(callback);
      socketRef.current?.off(event, callback);
    } else {
      listenersRef.current.delete(event);
      socketRef.current?.off(event);
    }
  }, []);

  const emit = useCallback((event: string, data?: unknown) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn(`Socket not connected, cannot emit event: ${event}`);
    }
  }, []);

  // Initialize socket connection when user logs in
  useEffect(() => {
    if (!user) {
      // Close socket if user logs out
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setIsConnected(false);
      }
      return;
    }

    // Create socket connection with JWT auth
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000';

    socketRef.current = io(socketUrl, {
      auth: (cb) => {
        const token = getAccessToken();
        if (token) {
          cb({ token });
        } else {
          cb(new Error('No access token available'));
        }
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    const socket = socketRef.current;

    // Replay every subscription registered so far (via `on()`, possibly
    // before this socket existed) onto the freshly created instance.
    for (const [event, callbacks] of listenersRef.current) {
      for (const cb of callbacks) {
        socket.on(event, cb);
      }
    }

    socket.on('connect', () => {
      console.debug('Socket connected');
      setIsConnected(true);

      // Re-join the active conversation on every connect event (initial and reconnect)
      // This is a specific design requirement to handle reconnects properly
      if (activeConversationRef.current) {
        socket.emit('conversation:join', {
          conversationId: activeConversationRef.current,
        });
      }
    });

    socket.on('disconnect', () => {
      console.debug('Socket disconnected');
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [user]);

  // Use useMemo to avoid recreating context value on every render
  // but still allow updates to isConnected
  const contextValue = useMemo(
    (): SocketContextType => ({
      socket: socketRef.current,
      isConnected,
      setActiveConversation,
      on,
      off,
      emit,
    }),
    [isConnected, setActiveConversation, on, off, emit]
  );

  return <SocketContext.Provider value={contextValue}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
