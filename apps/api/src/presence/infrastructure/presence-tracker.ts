import { Injectable } from '@nestjs/common';

/**
 * Tracks the online/offline status of users based on authenticated socket connections.
 *
 * Multiple connections per user are supported (e.g., multiple tabs/devices).
 * A user is marked online when their first connection is established.
 * A user is marked offline only when their last connection is closed.
 *
 * Implementation: in-process only, no external cache/state.
 */
@Injectable()
export class PresenceTracker {
  /**
   * Map of userId -> count of currently-open authenticated connections
   */
  private connectionCounts = new Map<string, number>();

  /**
   * Map of userId -> Set of socket IDs currently connected for that user
   */
  private userSockets = new Map<string, Set<string>>();

  /**
   * Add a connection for a user.
   *
   * @param userId The authenticated user ID
   * @param socketId The socket ID of the new connection
   * @returns true if this was the user's first connection (status transition from offline -> online),
   *          false if the user already had other open connections
   */
  addConnection(userId: string, socketId: string): boolean {
    const currentCount = this.connectionCounts.get(userId) ?? 0;

    // Track the socket
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);

    // Increment connection count
    const newCount = currentCount + 1;
    this.connectionCounts.set(userId, newCount);

    // Return true if this is the first connection (transition to online)
    return currentCount === 0;
  }

  /**
   * Remove a connection for a user.
   *
   * @param userId The authenticated user ID
   * @param socketId The socket ID of the closing connection
   * @returns true if this was the user's last connection (status transition from online -> offline),
   *          false if the user still has other open connections
   */
  removeConnection(userId: string, socketId: string): boolean {
    const currentCount = this.connectionCounts.get(userId) ?? 0;

    // Remove the socket
    const sockets = this.userSockets.get(userId);
    let socketWasFound = false;
    if (sockets) {
      socketWasFound = sockets.has(socketId);
      sockets.delete(socketId);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    // If the socket wasn't actually in our tracking, don't decrement the count
    if (!socketWasFound) {
      return false;
    }

    if (currentCount <= 0) {
      // No connection to remove; this shouldn't happen in normal operation
      return false;
    }

    const newCount = currentCount - 1;
    if (newCount === 0) {
      // This was the last connection; remove from map
      this.connectionCounts.delete(userId);
      return true; // Transition to offline
    }

    this.connectionCounts.set(userId, newCount);
    return false; // User still online
  }

  /**
   * Check if a user is currently online.
   *
   * @param userId The user ID
   * @returns true if the user has at least one open connection
   */
  isOnline(userId: string): boolean {
    const count = this.connectionCounts.get(userId) ?? 0;
    return count > 0;
  }

  /**
   * Get all socket IDs for a user.
   *
   * @param userId The user ID
   * @returns Set of socket IDs, or empty Set if user is offline
   */
  getSocketsForUser(userId: string): Set<string> {
    return this.userSockets.get(userId) ?? new Set();
  }
}
