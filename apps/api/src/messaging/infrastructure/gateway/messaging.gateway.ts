import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtTokenService } from '../../../identity/infrastructure/adapters/jwt-token.service.js';
import { InvalidTokenError } from '../../../identity/domain/errors.js';
import { SendMessage, SendMessageRequest, MarkConversationRead, MarkConversationReadRequest } from '../../application/index.js';
import { MongooseConversationRepository } from '../persistence/mongoose-conversation.repository.js';
import { PresenceTracker } from '../../../presence/infrastructure/presence-tracker.js';
import { RabbitMqEventPublisher } from '../../../shared-kernel/infrastructure/rabbitmq-event-publisher.js';

/**
 * Socket data shape for typed socket instances
 */
interface AuthenticatedSocket extends Socket {
  data: {
    userId?: string;
  };
}

/**
 * Messaging WebSocket Gateway
 *
 * Security model:
 * - JWT access token is verified during the handshake
 * - userId is derived ONLY from the verified token, never from client payloads
 * - userId is stored on socket.data and used for all subsequent operations
 * - Client messages cannot set or change the userId
 *
 * Handlers:
 * - conversation:join - join a Socket.IO room for a conversation (membership verified)
 * - conversation:leave - leave a Socket.IO room for a conversation
 * - message:send - send a message to a conversation (delegates to SendMessage use case, broadcasts to room)
 */
@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_ORIGIN || 'http://localhost:3000',
    credentials: true,
  },
})
export class MessagingGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(MessagingGateway.name);

  /**
   * Typing indicator timeout in milliseconds.
   * If a member sends typing:start but no typing:stop within this interval,
   * the server automatically broadcasts typing:false.
   */
  private readonly TYPING_TIMEOUT_MS = 5000; // 5 seconds

  /**
   * Map of (conversationId, userId) -> timeout handle
   * Used to track and clear typing timeouts.
   * Key format: `${conversationId}:${userId}`
   */
  private typingTimeouts = new Map<string, NodeJS.Timeout>();

  constructor(
    private jwtTokenService: JwtTokenService,
    private sendMessage: SendMessage,
    private markConversationRead: MarkConversationRead,
    private conversationRepository: MongooseConversationRepository,
    private presenceTracker: PresenceTracker,
    private eventPublisher: RabbitMqEventPublisher,
  ) {}

  /**
   * Handle new WebSocket connections
   *
   * Authenticates the client by verifying the JWT access token from the handshake.
   * If authentication fails, the connection is immediately refused.
   * If successful, the userId is stored on socket.data for the lifetime of the connection.
   *
   * On successful authentication:
   * - Tracks the connection in PresenceTracker
   * - If this is the user's first connection (status transition offline -> online),
   *   notifies members of shared conversations that this user is now online
   */
  async handleConnection(socket: AuthenticatedSocket): Promise<void> {
    try {
      // Extract token from handshake auth
      // Standard socket.io-client convention: io(url, { auth: { token } })
      const token = socket.handshake.auth.token;

      if (!token) {
        this.logger.warn(`Connection attempt without token from ${socket.id}`);
        socket.disconnect(true);
        return;
      }

      // Verify the token and extract userId
      const userId = await this.jwtTokenService.verifyAccessToken(token);

      // Store the verified userId on the socket instance
      // This is the ONLY place userId is ever set, for the entire lifetime of this socket
      socket.data.userId = userId;

      this.logger.debug(`User ${userId} connected via socket ${socket.id}`);

      // Track this connection in the presence tracker
      const isFirstConnection = this.presenceTracker.addConnection(userId, socket.id);

      // If this is the first connection (user just came online),
      // notify members of shared conversations and publish the event
      if (isFirstConnection) {
        await this.broadcastPresenceUpdate(userId, 'online');
        // Publish user.online event (after the presence transition is confirmed)
        await this.eventPublisher.publish('user.online', {
          userId,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        this.logger.warn(`Connection attempt with invalid token from ${socket.id}`);
      } else {
        this.logger.error(`Unexpected error during connection handshake for ${socket.id}:`, error);
      }
      socket.disconnect(true);
    }
  }

  /**
   * Handle WebSocket disconnections
   *
   * Removes the connection from PresenceTracker.
   * If this was the user's last connection (status transition online -> offline),
   * notifies members of shared conversations that this user is now offline.
   *
   * Also cleans up any pending typing timeout handlers for this socket's user.
   */
  handleDisconnect(socket: Socket): void {
    const userId = (socket as AuthenticatedSocket).data?.userId;
    this.logger.debug(
      `Socket ${socket.id} disconnected${userId ? ` (user ${userId})` : ''}`,
    );

    if (!userId) {
      return;
    }

    // Track the disconnection
    const isLastConnection = this.presenceTracker.removeConnection(userId, socket.id);

    // Clean up any pending typing timeouts for this user
    this.cleanupUserTypingTimeouts(userId);

    // If this was the user's last connection (now offline),
    // notify members of shared conversations and publish the event
    if (isLastConnection) {
      this.broadcastPresenceUpdate(userId, 'offline').catch((error) => {
        this.logger.error(
          `Error broadcasting offline status for user ${userId}:`,
          error,
        );
      });
      // Publish user.offline event (after the presence transition is confirmed)
      this.eventPublisher.publish('user.offline', {
        userId,
        timestamp: new Date().toISOString(),
      }).catch((error) => {
        this.logger.error(
          `Error publishing user.offline event for user ${userId}:`,
          error,
        );
      });
    }
  }

  /**
   * Join a conversation's Socket.IO room
   *
   * Verifies that the user is a member of the conversation before allowing them to join.
   * The room is named `conversation:${conversationId}` and is used to broadcast messages
   * to all connected members.
   */
  @SubscribeMessage('conversation:join')
  handleConversationJoin(
    socket: AuthenticatedSocket,
    data: { conversationId: string },
  ): void {
    this.handleConversationJoinAsync(socket, data).catch((error) => {
      this.logger.error(`Unhandled error in conversation:join:`, error);
    });
  }

  private async handleConversationJoinAsync(
    socket: AuthenticatedSocket,
    data: { conversationId: string },
  ): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        this.logger.warn(`conversation:join from unauthenticated socket ${socket.id}`);
        socket.emit('conversation:join:error', { message: 'Not authenticated' });
        return;
      }

      const { conversationId } = data;

      // Fetch the conversation to verify membership
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation) {
        this.logger.warn(
          `User ${userId} attempted to join non-existent conversation ${conversationId}`,
        );
        socket.emit('conversation:join:error', { message: 'Conversation not found' });
        return;
      }

      // Check if the user is a member of this conversation
      if (!conversation.isMember(userId)) {
        this.logger.warn(
          `User ${userId} attempted to join conversation ${conversationId} they are not a member of`,
        );
        socket.emit('conversation:join:error', { message: 'Not a member of this conversation' });
        return;
      }

      // Join the Socket.IO room for this conversation
      const roomName = `conversation:${conversationId}`;
      await socket.join(roomName);
      this.logger.debug(`User ${userId} joined conversation room ${roomName}`);
    } catch (error) {
      this.logger.error(`Error in conversation:join handler:`, error);
      socket.emit('conversation:join:error', { message: 'Internal server error' });
    }
  }

  /**
   * Leave a conversation's Socket.IO room
   */
  @SubscribeMessage('conversation:leave')
  handleConversationLeave(
    socket: AuthenticatedSocket,
    data: { conversationId: string },
  ): void {
    this.handleConversationLeaveAsync(socket, data).catch((error) => {
      this.logger.error(`Unhandled error in conversation:leave:`, error);
    });
  }

  private async handleConversationLeaveAsync(
    socket: AuthenticatedSocket,
    data: { conversationId: string },
  ): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        this.logger.warn(`conversation:leave from unauthenticated socket ${socket.id}`);
        return;
      }

      const { conversationId } = data;
      const roomName = `conversation:${conversationId}`;

      await socket.leave(roomName);
      this.logger.debug(`User ${userId} left conversation room ${roomName}`);
    } catch (error) {
      this.logger.error(`Error in conversation:leave handler:`, error);
      socket.emit('conversation:leave:error', { message: 'Internal server error' });
    }
  }

  /**
   * Send a message to a conversation
   *
   * Delegates to the SendMessage use case, which validates:
   * - The sender is a member of the conversation
   * - The message text is non-empty and within the length limit
   *
   * On success, broadcasts the message to all members in the conversation room.
   * On failure, emits an error event back to the sender only.
   *
   * Broadcast strategy: Include the sender in the broadcast (they receive their own message).
   * This is simpler and matches common patterns; if a different UX is needed (ack sender separately),
   * that can be changed later without breaking the protocol.
   */
  @SubscribeMessage('message:send')
  handleMessageSend(
    socket: AuthenticatedSocket,
    data: { conversationId: string; text: string },
  ): void {
    this.handleMessageSendAsync(socket, data).catch((error) => {
      this.logger.error(`Unhandled error in message:send:`, error);
    });
  }

  private async handleMessageSendAsync(
    socket: AuthenticatedSocket,
    data: { conversationId: string; text: string },
  ): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        this.logger.warn(`message:send from unauthenticated socket ${socket.id}`);
        socket.emit('message:send:error', { message: 'Not authenticated' });
        return;
      }

      const { conversationId, text } = data;

      // Call the SendMessage use case
      const request: SendMessageRequest = {
        senderId: userId,
        conversationId,
        text,
      };

      const result = await this.sendMessage.execute(request);

      if (!result.isOk()) {
        // Use case returned an error - emit it back to the sender only
        const error = result.error;
        this.logger.debug(
          `message:send failed for user ${userId} in conversation ${conversationId}: ${error.constructor.name}`,
        );
        socket.emit('message:send:error', { message: error.message });
        return;
      }

      // Success - broadcast the message to all members in the conversation room
      const response = result.value;
      const roomName = `conversation:${conversationId}`;

      this.server.to(roomName).emit('message:new', {
        messageId: response.messageId,
        conversationId: response.conversationId,
        senderId: response.senderId,
        text: response.text,
        createdAt: response.createdAt,
      });

      this.logger.debug(
        `Message ${response.messageId} from user ${userId} broadcast to room ${roomName}`,
      );
    } catch (error) {
      this.logger.error(`Unexpected error in message:send handler:`, error);
      socket.emit('message:send:error', { message: 'Internal server error' });
    }
  }

  /**
   * Mark a conversation as read up to a specific message
   *
   * Delegates to the MarkConversationRead use case, which validates:
   * - The requester is a member of the conversation
   * - The message belongs to the conversation
   *
   * On success, broadcasts the updated read position to all members in the conversation room.
   * On failure, emits an error event back to the sender only.
   */
  @SubscribeMessage('message:read')
  handleMessageRead(
    socket: AuthenticatedSocket,
    data: { conversationId: string; messageId: string },
  ): void {
    this.handleMessageReadAsync(socket, data).catch((error) => {
      this.logger.error(`Unhandled error in message:read:`, error);
    });
  }

  private async handleMessageReadAsync(
    socket: AuthenticatedSocket,
    data: { conversationId: string; messageId: string },
  ): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        this.logger.warn(`message:read from unauthenticated socket ${socket.id}`);
        socket.emit('message:read:error', { message: 'Not authenticated' });
        return;
      }

      const { conversationId, messageId } = data;

      // Call the MarkConversationRead use case
      const request: MarkConversationReadRequest = {
        requesterId: userId,
        conversationId,
        messageId,
      };

      const result = await this.markConversationRead.execute(request);

      if (!result.isOk()) {
        // Use case returned an error - emit it back to the sender only
        const error = result.error;
        this.logger.debug(
          `message:read failed for user ${userId} in conversation ${conversationId}: ${error.constructor.name}`,
        );
        socket.emit('message:read:error', { message: error.message });
        return;
      }

      // Success - broadcast the read position to all members in the conversation room
      const response = result.value;
      const roomName = `conversation:${conversationId}`;

      this.server.to(roomName).emit('message:read:update', {
        conversationId: response.conversationId,
        userId: response.userId,
        messageId: response.messageId,
      });

      this.logger.debug(
        `User ${userId} marked conversation ${conversationId} as read up to message ${messageId}`,
      );
    } catch (error) {
      this.logger.error(`Unexpected error in message:read handler:`, error);
      socket.emit('message:read:error', { message: 'Internal server error' });
    }
  }

  /**
   * Handle typing indicator - user starts typing
   *
   * Verifies the user is a member of the conversation, then broadcasts a typing update
   * to other members in that conversation room (excluding the sender).
   *
   * Also starts a server-side timeout that will automatically clear the typing indicator
   * if no typing:stop or further typing:start arrives within the timeout period.
   */
  @SubscribeMessage('typing:start')
  handleTypingStart(
    socket: AuthenticatedSocket,
    data: { conversationId: string },
  ): void {
    this.handleTypingStartAsync(socket, data).catch((error) => {
      this.logger.error(`Unhandled error in typing:start:`, error);
    });
  }

  private async handleTypingStartAsync(
    socket: AuthenticatedSocket,
    data: { conversationId: string },
  ): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        this.logger.warn(`typing:start from unauthenticated socket ${socket.id}`);
        socket.emit('typing:start:error', { message: 'Not authenticated' });
        return;
      }

      const { conversationId } = data;

      // Verify the user is a member of the conversation
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation) {
        this.logger.warn(
          `User ${userId} attempted typing:start in non-existent conversation ${conversationId}`,
        );
        socket.emit('typing:start:error', { message: 'Conversation not found' });
        return;
      }

      if (!conversation.isMember(userId)) {
        this.logger.warn(
          `User ${userId} attempted typing:start in conversation ${conversationId} they are not a member of`,
        );
        socket.emit('typing:start:error', { message: 'Not a member of this conversation' });
        return;
      }

      // Broadcast typing update to other members in the room
      const roomName = `conversation:${conversationId}`;
      socket.to(roomName).emit('typing:update', {
        conversationId,
        userId,
        isTyping: true,
      });

      this.logger.debug(
        `User ${userId} started typing in conversation ${conversationId}`,
      );

      // Set up auto-clear timeout
      const timeoutKey = `${conversationId}:${userId}`;
      this.clearTypingTimeout(timeoutKey);

      const timeout = setTimeout(() => {
        // Timeout expired - broadcast auto-clear to room
        this.server.to(roomName).emit('typing:update', {
          conversationId,
          userId,
          isTyping: false,
        });
        this.typingTimeouts.delete(timeoutKey);
        this.logger.debug(
          `Typing indicator for user ${userId} in conversation ${conversationId} auto-cleared after timeout`,
        );
      }, this.TYPING_TIMEOUT_MS);

      this.typingTimeouts.set(timeoutKey, timeout);
    } catch (error) {
      this.logger.error(`Unexpected error in typing:start handler:`, error);
      socket.emit('typing:start:error', { message: 'Internal server error' });
    }
  }

  /**
   * Handle typing indicator - user stops typing
   *
   * Verifies the user is a member of the conversation, then broadcasts a typing update
   * to other members in that conversation room (excluding the sender).
   *
   * Also clears any pending auto-clear timeout for this user in this conversation.
   */
  @SubscribeMessage('typing:stop')
  handleTypingStop(
    socket: AuthenticatedSocket,
    data: { conversationId: string },
  ): void {
    this.handleTypingStopAsync(socket, data).catch((error) => {
      this.logger.error(`Unhandled error in typing:stop:`, error);
    });
  }

  private async handleTypingStopAsync(
    socket: AuthenticatedSocket,
    data: { conversationId: string },
  ): Promise<void> {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        this.logger.warn(`typing:stop from unauthenticated socket ${socket.id}`);
        socket.emit('typing:stop:error', { message: 'Not authenticated' });
        return;
      }

      const { conversationId } = data;

      // Verify the user is a member of the conversation
      const conversation = await this.conversationRepository.findById(conversationId);
      if (!conversation) {
        this.logger.warn(
          `User ${userId} attempted typing:stop in non-existent conversation ${conversationId}`,
        );
        socket.emit('typing:stop:error', { message: 'Conversation not found' });
        return;
      }

      if (!conversation.isMember(userId)) {
        this.logger.warn(
          `User ${userId} attempted typing:stop in conversation ${conversationId} they are not a member of`,
        );
        socket.emit('typing:stop:error', { message: 'Not a member of this conversation' });
        return;
      }

      // Broadcast typing update to other members in the room
      const roomName = `conversation:${conversationId}`;
      socket.to(roomName).emit('typing:update', {
        conversationId,
        userId,
        isTyping: false,
      });

      this.logger.debug(
        `User ${userId} stopped typing in conversation ${conversationId}`,
      );

      // Clear any pending auto-clear timeout
      const timeoutKey = `${conversationId}:${userId}`;
      this.clearTypingTimeout(timeoutKey);
    } catch (error) {
      this.logger.error(`Unexpected error in typing:stop handler:`, error);
      socket.emit('typing:stop:error', { message: 'Internal server error' });
    }
  }

  /**
   * Broadcast a presence update (online/offline) to members of shared conversations.
   *
   * Finds all conversations the user is a member of, collects all other member ids,
   * and emits a presence:update event to all connected sockets of those members.
   *
   * Implementation strategy:
   * - Fetches all conversations for the user
   * - Extracts unique member ids from all conversations (excluding the user themselves)
   * - For each member, gets their connected socket ids from PresenceTracker
   * - Emits presence:update to each of those sockets
   *
   * @param userId The user whose status changed
   * @param status The new status: 'online' or 'offline'
   */
  private async broadcastPresenceUpdate(
    userId: string,
    status: 'online' | 'offline',
  ): Promise<void> {
    try {
      // Get all conversations for this user
      const conversations = await this.conversationRepository.findAllForUser(userId);

      // Collect unique member ids across all conversations (excluding the user)
      const memberIds = new Set<string>();
      for (const conversation of conversations) {
        for (const member of conversation.memberIds) {
          if (member !== userId) {
            memberIds.add(member);
          }
        }
      }

      // Emit presence:update to each member's connected sockets
      for (const memberId of memberIds) {
        const sockets = this.presenceTracker.getSocketsForUser(memberId);
        for (const socketId of sockets) {
          const socket = this.server.sockets.sockets.get(socketId);
          if (socket) {
            socket.emit('presence:update', {
              userId,
              status,
            });
          }
        }
      }

      this.logger.debug(
        `Presence update (${status}) for user ${userId} sent to ${memberIds.size} members`,
      );
    } catch (error) {
      this.logger.error(
        `Error broadcasting presence update for user ${userId}:`,
        error,
      );
    }
  }

  /**
   * Clear a typing timeout if it exists.
   *
   * @param timeoutKey The key: `${conversationId}:${userId}`
   */
  private clearTypingTimeout(timeoutKey: string): void {
    const existingTimeout = this.typingTimeouts.get(timeoutKey);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.typingTimeouts.delete(timeoutKey);
    }
  }

  /**
   * Clean up all pending typing timeouts for a user.
   * Called when the user disconnects to avoid timer leaks.
   *
   * @param userId The user id
   */
  private cleanupUserTypingTimeouts(userId: string): void {
    const keysToDelete: string[] = [];
    for (const key of this.typingTimeouts.keys()) {
      // Key format: `${conversationId}:${userId}`
      if (key.endsWith(`:${userId}`)) {
        this.clearTypingTimeout(key);
        keysToDelete.push(key);
      }
    }
    if (keysToDelete.length > 0) {
      this.logger.debug(
        `Cleaned up ${keysToDelete.length} typing timeouts for user ${userId}`,
      );
    }
  }
}
