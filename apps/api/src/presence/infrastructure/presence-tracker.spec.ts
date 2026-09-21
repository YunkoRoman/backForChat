import { PresenceTracker } from './presence-tracker.js';

describe('PresenceTracker', () => {
  let tracker: PresenceTracker;

  beforeEach(() => {
    tracker = new PresenceTracker();
  });

  describe('addConnection', () => {
    it('should return true when adding the first connection for a user', () => {
      const result = tracker.addConnection('user-1', 'socket-1');
      expect(result).toBe(true);
      expect(tracker.isOnline('user-1')).toBe(true);
    });

    it('should return false when adding a second connection for the same user', () => {
      tracker.addConnection('user-1', 'socket-1');
      const result = tracker.addConnection('user-1', 'socket-2');
      expect(result).toBe(false);
      expect(tracker.isOnline('user-1')).toBe(true);
    });

    it('should track multiple sockets for the same user', () => {
      tracker.addConnection('user-1', 'socket-1');
      tracker.addConnection('user-1', 'socket-2');
      tracker.addConnection('user-1', 'socket-3');

      const sockets = tracker.getSocketsForUser('user-1');
      expect(sockets.size).toBe(3);
      expect(sockets.has('socket-1')).toBe(true);
      expect(sockets.has('socket-2')).toBe(true);
      expect(sockets.has('socket-3')).toBe(true);
    });

    it('should handle independent users correctly', () => {
      tracker.addConnection('user-1', 'socket-1');
      tracker.addConnection('user-2', 'socket-2');

      expect(tracker.isOnline('user-1')).toBe(true);
      expect(tracker.isOnline('user-2')).toBe(true);
    });
  });

  describe('removeConnection', () => {
    it('should return false when removing the first of multiple connections', () => {
      tracker.addConnection('user-1', 'socket-1');
      tracker.addConnection('user-1', 'socket-2');

      const result = tracker.removeConnection('user-1', 'socket-1');
      expect(result).toBe(false);
      expect(tracker.isOnline('user-1')).toBe(true);
    });

    it('should return true when removing the last connection for a user', () => {
      tracker.addConnection('user-1', 'socket-1');
      tracker.addConnection('user-1', 'socket-2');

      tracker.removeConnection('user-1', 'socket-1');
      const result = tracker.removeConnection('user-1', 'socket-2');

      expect(result).toBe(true);
      expect(tracker.isOnline('user-1')).toBe(false);
    });

    it('should remove the socket from the user sockets set', () => {
      tracker.addConnection('user-1', 'socket-1');
      tracker.addConnection('user-1', 'socket-2');

      tracker.removeConnection('user-1', 'socket-1');

      const sockets = tracker.getSocketsForUser('user-1');
      expect(sockets.has('socket-1')).toBe(false);
      expect(sockets.has('socket-2')).toBe(true);
    });

    it('should handle single connection online->offline', () => {
      const addResult = tracker.addConnection('user-1', 'socket-1');
      expect(addResult).toBe(true);
      expect(tracker.isOnline('user-1')).toBe(true);

      const removeResult = tracker.removeConnection('user-1', 'socket-1');
      expect(removeResult).toBe(true);
      expect(tracker.isOnline('user-1')).toBe(false);
    });

    it('should handle removing a non-existent socket gracefully', () => {
      tracker.addConnection('user-1', 'socket-1');
      // Try to remove a socket that doesn't exist
      const _result = tracker.removeConnection('user-1', 'socket-99');

      // Should still have the real socket
      expect(tracker.isOnline('user-1')).toBe(true);
      const sockets = tracker.getSocketsForUser('user-1');
      expect(sockets.has('socket-1')).toBe(true);
    });

    it('should return false when removing from offline user', () => {
      const _result = tracker.removeConnection('user-99', 'socket-99');
      expect(_result).toBe(false);
      expect(tracker.isOnline('user-99')).toBe(false);
    });
  });

  describe('isOnline', () => {
    it('should return false for a user with no connections', () => {
      expect(tracker.isOnline('user-1')).toBe(false);
    });

    it('should return true for a user with at least one connection', () => {
      tracker.addConnection('user-1', 'socket-1');
      expect(tracker.isOnline('user-1')).toBe(true);
    });

    it('should return false after all connections are removed', () => {
      tracker.addConnection('user-1', 'socket-1');
      expect(tracker.isOnline('user-1')).toBe(true);

      tracker.removeConnection('user-1', 'socket-1');
      expect(tracker.isOnline('user-1')).toBe(false);
    });
  });

  describe('getSocketsForUser', () => {
    it('should return empty set for offline user', () => {
      const sockets = tracker.getSocketsForUser('user-99');
      expect(sockets.size).toBe(0);
    });

    it('should return all sockets for online user', () => {
      tracker.addConnection('user-1', 'socket-1');
      tracker.addConnection('user-1', 'socket-2');

      const sockets = tracker.getSocketsForUser('user-1');
      expect(sockets.size).toBe(2);
      expect(sockets.has('socket-1')).toBe(true);
      expect(sockets.has('socket-2')).toBe(true);
    });

    it('should return independent sets for different users', () => {
      tracker.addConnection('user-1', 'socket-1');
      tracker.addConnection('user-2', 'socket-2');

      const sockets1 = tracker.getSocketsForUser('user-1');
      const sockets2 = tracker.getSocketsForUser('user-2');

      expect(sockets1.has('socket-1')).toBe(true);
      expect(sockets1.has('socket-2')).toBe(false);
      expect(sockets2.has('socket-2')).toBe(true);
      expect(sockets2.has('socket-1')).toBe(false);
    });
  });
});
