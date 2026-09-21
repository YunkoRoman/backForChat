import { describe, it, expect, beforeEach } from 'vitest';
import { SendMessage } from './send-message.use-case.js';
import { ConversationRepository } from './ports/conversation-repository.interface.js';
import { MessageRepository, MessageCursor } from './ports/message-repository.interface.js';
import { Conversation } from '../domain/conversation.aggregate.js';
import { Message } from '../domain/message.entity.js';
import {
  RequesterNotAMemberError,
  EmptyMessageError,
  MessageTooLongError,
} from '../domain/errors.js';

/**
 * In-memory fake implementation of ConversationRepository for testing.
 */
class FakeConversationRepository implements ConversationRepository {
  private conversations = new Map<string, Conversation>();

  async findById(id: string): Promise<Conversation | null> {
    return this.conversations.get(id) ?? null;
  }

  async findOneToOneBetween(): Promise<Conversation | null> {
    return null;
  }

  async findAllForUser(userId: string): Promise<Conversation[]> {
    const result: Conversation[] = [];
    for (const conv of this.conversations.values()) {
      if (conv.isMember(userId)) {
        result.push(conv);
      }
    }
    return result;
  }

  async save(conversation: Conversation): Promise<void> {
    this.conversations.set(conversation.id, conversation);
  }

  async delete(id: string): Promise<void> {
    this.conversations.delete(id);
  }
}

/**
 * In-memory fake implementation of MessageRepository for testing.
 */
class FakeMessageRepository implements MessageRepository {
  private messages = new Map<string, Message>();

  async findById(id: string): Promise<Message | null> {
    return this.messages.get(id) ?? null;
  }

  async findByConversationId(conversationId: string, cursor: MessageCursor) {
    const allMessages = Array.from(this.messages.values())
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    let startIndex = 0;
    if (cursor.before) {
      const beforeIndex = allMessages.findIndex((m) => m.id === cursor.before);
      if (beforeIndex !== -1) {
        startIndex = beforeIndex + 1;
      }
    }

    const messages = allMessages.slice(startIndex, startIndex + cursor.limit);
    const hasMore = startIndex + cursor.limit < allMessages.length;
    const nextCursor = hasMore && messages.length > 0 ? { before: messages[messages.length - 1].id, limit: cursor.limit } : null;

    return { messages, nextCursor };
  }

  async save(message: Message): Promise<void> {
    this.messages.set(message.id, message);
  }

  async delete(id: string): Promise<void> {
    this.messages.delete(id);
  }
}

describe('SendMessage Use Case', () => {
  let useCase: SendMessage;
  let conversationRepository: FakeConversationRepository;
  let messageRepository: FakeMessageRepository;

  beforeEach(() => {
    conversationRepository = new FakeConversationRepository();
    messageRepository = new FakeMessageRepository();
    useCase = new SendMessage(conversationRepository, messageRepository);
  });

  describe('message sent and delivered', () => {
    it('should send a valid message from a conversation member', async () => {
      const conv = Conversation.createGroup('conv-1', 'Team', ['user-1', 'user-2'], 'user-1');
      await conversationRepository.save(conv);

      const result = await useCase.execute({
        senderId: 'user-1',
        conversationId: 'conv-1',
        text: 'Hello, team!',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.text).toBe('Hello, team!');
        expect(result.value.senderId).toBe('user-1');
        expect(result.value.conversationId).toBe('conv-1');

        // Verify persistence
        const persisted = await messageRepository.findById(result.value.messageId);
        expect(persisted).toBeDefined();
        expect(persisted?.text).toBe('Hello, team!');
      }
    });

    it('should set the createdAt timestamp', async () => {
      const conv = Conversation.createGroup('conv-1', 'Team', ['user-1', 'user-2'], 'user-1');
      await conversationRepository.save(conv);

      const beforeTime = new Date();
      const result = await useCase.execute({
        senderId: 'user-1',
        conversationId: 'conv-1',
        text: 'Test message',
      });
      const afterTime = new Date();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        expect(result.value.createdAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      }
    });

    it('should allow 1:1 conversation members to send messages', async () => {
      const conv = Conversation.createOneToOne('conv-1', 'user-1', 'user-2', 'user-1');
      await conversationRepository.save(conv);

      const result = await useCase.execute({
        senderId: 'user-2',
        conversationId: 'conv-1',
        text: 'Hey there!',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.senderId).toBe('user-2');
      }
    });
  });

  describe('empty message rejected', () => {
    it('should reject an empty message', async () => {
      const conv = Conversation.createGroup('conv-1', 'Team', ['user-1', 'user-2'], 'user-1');
      await conversationRepository.save(conv);

      const result = await useCase.execute({
        senderId: 'user-1',
        conversationId: 'conv-1',
        text: '',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(EmptyMessageError);
      }
    });

    it('should reject a whitespace-only message', async () => {
      const conv = Conversation.createGroup('conv-1', 'Team', ['user-1', 'user-2'], 'user-1');
      await conversationRepository.save(conv);

      const result = await useCase.execute({
        senderId: 'user-1',
        conversationId: 'conv-1',
        text: '   \n   ',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(EmptyMessageError);
      }
    });
  });

  describe('message length validation', () => {
    it('should reject a message that exceeds the maximum length', async () => {
      const conv = Conversation.createGroup('conv-1', 'Team', ['user-1', 'user-2'], 'user-1');
      await conversationRepository.save(conv);

      const tooLongText = 'a'.repeat(Message.MAX_LENGTH + 1);

      const result = await useCase.execute({
        senderId: 'user-1',
        conversationId: 'conv-1',
        text: tooLongText,
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(MessageTooLongError);
      }
    });

    it('should accept a message at the maximum length', async () => {
      const conv = Conversation.createGroup('conv-1', 'Team', ['user-1', 'user-2'], 'user-1');
      await conversationRepository.save(conv);

      const maxText = 'a'.repeat(Message.MAX_LENGTH);

      const result = await useCase.execute({
        senderId: 'user-1',
        conversationId: 'conv-1',
        text: maxText,
      });

      expect(result.isOk()).toBe(true);
    });
  });

  describe('non-member cannot send', () => {
    it('should reject a message from a non-member', async () => {
      const conv = Conversation.createGroup('conv-1', 'Team', ['user-1', 'user-2'], 'user-1');
      await conversationRepository.save(conv);

      const result = await useCase.execute({
        senderId: 'user-3',
        conversationId: 'conv-1',
        text: 'Unauthorized message',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(RequesterNotAMemberError);
      }
    });

    it('should reject a message if the conversation does not exist', async () => {
      const result = await useCase.execute({
        senderId: 'user-1',
        conversationId: 'nonexistent',
        text: 'Message to void',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(RequesterNotAMemberError);
      }
    });
  });
});
