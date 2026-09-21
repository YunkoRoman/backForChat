import { Result, ok, err } from '../../shared-kernel/index.js';
import {
  Message,
  RequesterNotAMemberError,
  EmptyMessageError,
  MessageTooLongError,
} from '../domain/index.js';
import { ConversationRepository } from './ports/conversation-repository.interface.js';
import { MessageRepository } from './ports/message-repository.interface.js';
import { randomUUID } from 'node:crypto';

export interface SendMessageRequest {
  senderId: string;
  conversationId: string;
  text: string;
}

export interface SendMessageResponse {
  messageId: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: Date;
}

export class SendMessage {
  constructor(
    private conversationRepository: ConversationRepository,
    private messageRepository: MessageRepository,
  ) {}

  async execute(
    request: SendMessageRequest,
  ): Promise<
    Result<SendMessageResponse, RequesterNotAMemberError | EmptyMessageError | MessageTooLongError>
  > {
    const { senderId, conversationId, text } = request;

    // Fetch the conversation
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      return err(new RequesterNotAMemberError());
    }

    // Check if sender is a member
    if (!conversation.isMember(senderId)) {
      return err(new RequesterNotAMemberError());
    }

    // Try to create the message (will throw if text is empty or too long)
    try {
      const messageId = randomUUID();
      const message = Message.create(messageId, conversationId, senderId, text);

      // Persist the message
      await this.messageRepository.save(message);

      return ok({
        messageId: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        text: message.text,
        createdAt: message.createdAt,
      });
    } catch (error) {
      if (error instanceof EmptyMessageError) {
        return err(error);
      }
      if (error instanceof MessageTooLongError) {
        return err(error);
      }
      throw error;
    }
  }
}
