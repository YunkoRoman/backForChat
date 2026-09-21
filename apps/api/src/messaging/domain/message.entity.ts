import {
  EmptyMessageError,
  MessageTooLongError,
} from './errors.js';

export class Message {
  // Maximum message length in characters
  static readonly MAX_LENGTH = 4000;

  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly text: string;
  readonly createdAt: Date;

  constructor(
    id: string,
    conversationId: string,
    senderId: string,
    text: string,
    createdAt: Date,
  ) {
    // Validate text
    if (!text || text.trim().length === 0) {
      throw new EmptyMessageError();
    }

    if (text.length > Message.MAX_LENGTH) {
      throw new MessageTooLongError(Message.MAX_LENGTH);
    }

    this.id = id;
    this.conversationId = conversationId;
    this.senderId = senderId;
    this.text = text;
    this.createdAt = createdAt;
  }

  static create(
    id: string,
    conversationId: string,
    senderId: string,
    text: string,
  ): Message {
    return new Message(id, conversationId, senderId, text, new Date());
  }
}
