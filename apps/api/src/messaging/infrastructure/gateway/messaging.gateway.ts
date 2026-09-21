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
import { SendMessage, SendMessageRequest } from '../../application/index.js';
import { MongooseConversationRepository } from '../persistence/mongoose-conversation.repository.js';

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

  constructor(
    private jwtTokenService: JwtTokenService,
    private sendMessage: SendMessage,
    private conversationRepository: MongooseConversationRepository,
  ) {}

  /**
   * Handle new WebSocket connections
   *
   * Authenticates the client by verifying the JWT access token from the handshake.
   * If authentication fails, the connection is immediately refused.
   * If successful, the userId is stored on socket.data for the lifetime of the connection.
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
   */
  handleDisconnect(socket: Socket): void {
    const userId = (socket as AuthenticatedSocket).data?.userId;
    this.logger.debug(
      `Socket ${socket.id} disconnected${userId ? ` (user ${userId})` : ''}`,
    );
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
}
