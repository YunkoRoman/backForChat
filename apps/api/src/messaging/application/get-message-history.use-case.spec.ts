import { describe, it, expect, beforeEach } from 'vitest';
import { GetMessageHistory } from './get-message-history.use-case.js';
import { ConversationRepository } from './ports/conversation-repository.interface.js';
import { MessageRepository, MessageCursor } from './ports/message-repository.interface.js';
import { Conversation } from '../domain/conversation.aggregate.js';
import { Message } from '../domain/message.entity.js';
import { RequesterNotAMemberError } from '../domain/errors.js';

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

describe('GetMessageHistory Use Case', () => {
  let useCase: GetMessageHistory;
  let conversationRepository: FakeConversationRepository;
  let messageRepository: FakeMessageRepository;

  beforeEach(() => {
    conversationRepository = new FakeConversationRepository();
    messageRepository = new FakeMessageRepository();
    useCase = new GetMessageHistory(conversationRepository, messageRepository);
  });

  describe('member retrieves paginated history', () => {
    it('should return messages in reverse-chronological order (newest first)', async () => {
      const conv = Conversation.createGroup('conv-1', 'Team', ['user-1', 'user-2'], 'user-1');
      await conversationRepository.save(conv);

      // Add messages with slight delays to ensure different timestamps
      const msg1 = new Message('msg-1', 'conv-1', 'user-1', 'First', new Date('2025-01-01T10:00:00Z'));
      const msg2 = new Message('msg-2', 'conv-1', 'user-2', 'Second', new Date('2025-01-01T10:01:00Z'));
      const msg3 = new Message('msg-3', 'conv-1', 'user-1', 'Third', new Date('2025-01-01T10:02:00Z'));

      await messageRepository.save(msg1);
      await messageRepository.save(msg2);
      await messageRepository.save(msg3);

      const result = await useCase.execute({
        requesterId: 'user-1',
        conversationId: 'conv-1',
        cursor: { limit: 10 },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.messages).toHaveLength(3);
        // Newest first
        expect(result.value.messages[0].messageId).toBe('msg-3');
        expect(result.value.messages[1].messageId).toBe('msg-2');
        expect(result.value.messages[2].messageId).toBe('msg-1');
      }
    });

    it('should support pagination with cursor', async () => {
      const conv = Conversation.createGroup('conv-1', 'Team', ['user-1', 'user-2'], 'user-1');
      await conversationRepository.save(conv);

      // Add 5 messages
      for (let i = 1; i <= 5; i++) {
        const msg = new Message(
          `msg-${i}`,
          'conv-1',
          'user-1',
          `Message ${i}`,
          new Date(`2025-01-01T10:0${i}:00Z`),
        );
        await messageRepository.save(msg);
      }

      // Get first page (limit 2)
      const resultPage1 = await useCase.execute({
        requesterId: 'user-1',
        conversationId: 'conv-1',
        cursor: { limit: 2 },
      });

      expect(resultPage1.isOk()).toBe(true);
      if (resultPage1.isOk()) {
        expect(resultPage1.value.messages).toHaveLength(2);
        expect(resultPage1.value.nextCursor).toBeDefined();
        expect(resultPage1.value.messages[0].messageId).toBe('msg-5');

        // Get second page using the cursor
        const resultPage2 = await useCase.execute({
          requesterId: 'user-1',
          conversationId: 'conv-1',
          cursor: resultPage1.value.nextCursor!,
        });

        expect(resultPage2.isOk()).toBe(true);
        if (resultPage2.isOk()) {
          expect(resultPage2.value.messages).toHaveLength(2);
          expect(resultPage2.value.messages[0].messageId).toBe('msg-3');
        }
      }
    });

    it('should return null nextCursor when no more messages', async () => {
      const conv = Conversation.createGroup('conv-1', 'Team', ['user-1', 'user-2'], 'user-1');
      await conversationRepository.save(conv);

      const msg = new Message('msg-1', 'conv-1', 'user-1', 'Only message', new Date());
      await messageRepository.save(msg);

      const result = await useCase.execute({
        requesterId: 'user-1',
        conversationId: 'conv-1',
        cursor: { limit: 10 },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.messages).toHaveLength(1);
        expect(result.value.nextCursor).toBeNull();
      }
    });

    it('should return empty list for a conversation with no messages', async () => {
      const conv = Conversation.createGroup('conv-1', 'Team', ['user-1', 'user-2'], 'user-1');
      await conversationRepository.save(conv);

      const result = await useCase.execute({
        requesterId: 'user-1',
        conversationId: 'conv-1',
        cursor: { limit: 10 },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.messages).toHaveLength(0);
        expect(result.value.nextCursor).toBeNull();
      }
    });
  });

  describe('non-member cannot retrieve history', () => {
    it('should reject a non-member requesting history', async () => {
      const conv = Conversation.createGroup('conv-1', 'Team', ['user-1', 'user-2'], 'user-1');
      await conversationRepository.save(conv);

      const result = await useCase.execute({
        requesterId: 'user-3',
        conversationId: 'conv-1',
        cursor: { limit: 10 },
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(RequesterNotAMemberError);
      }
    });

    it('should reject if the conversation does not exist', async () => {
      const result = await useCase.execute({
        requesterId: 'user-1',
        conversationId: 'nonexistent',
        cursor: { limit: 10 },
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(RequesterNotAMemberError);
      }
    });
  });

  describe('returned message format', () => {
    it('should return message data in the correct format', async () => {
      const conv = Conversation.createGroup('conv-1', 'Team', ['user-1', 'user-2'], 'user-1');
      await conversationRepository.save(conv);

      const msg = new Message('msg-1', 'conv-1', 'user-1', 'Test message', new Date('2025-01-01T10:00:00Z'));
      await messageRepository.save(msg);

      const result = await useCase.execute({
        requesterId: 'user-1',
        conversationId: 'conv-1',
        cursor: { limit: 10 },
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.messages[0]).toEqual({
          messageId: 'msg-1',
          senderId: 'user-1',
          text: 'Test message',
          createdAt: new Date('2025-01-01T10:00:00Z'),
        });
      }
    });
  });
});
