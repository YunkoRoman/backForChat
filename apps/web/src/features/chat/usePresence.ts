import { useEffect, useState, useCallback } from 'react';
import { useSocket } from '../../api/SocketContext';

/**
 * Hook to track the online/offline status of all users.
 * Subscribes to presence:update events at the app level and maintains a map
 * of userId -> status ('online' | 'offline').
 */
export function usePresence() {
  const { on, off } = useSocket();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handlePresenceUpdate = (data: unknown) => {
      const presenceData = data as { userId: string; status: 'online' | 'offline' };
      const { userId, status } = presenceData;

      setOnlineUsers((prev) => {
        const updated = new Set(prev);
        if (status === 'online') {
          updated.add(userId);
        } else {
          updated.delete(userId);
        }
        return updated;
      });
    };

    on<{ userId: string; status: 'online' | 'offline' }>(
      'presence:update',
      handlePresenceUpdate as (...args: unknown[]) => void
    );

    return () => {
      off('presence:update', handlePresenceUpdate as (...args: unknown[]) => void);
    };
  }, [on, off]);

  const isUserOnline = useCallback(
    (userId: string) => onlineUsers.has(userId),
    [onlineUsers]
  );

  return { isUserOnline, onlineUsers };
}
