import { describe, it, expect, beforeEach } from 'vitest';
import { CreateOneToOneConversation } from './create-one-to-one-conversation.use-case.js';
import { ConversationRepository } from './ports/conversation-repository.interface.js';
import { EventPublisher } from '../../shared-kernel/index.js';
import { Conversation } from '../domain/conversation.aggregate.js';

/**
 * In-memory fake implementation of ConversationRepository for testing.
 */
class FakeConversationRepository implements ConversationRepository {
  private conversations = new Map<string, Conversation>();

  async findById(id: string): Promise<Conversation | null> {
    return this.conversations.get(id) ?? null;
  }

  async findOneToOneBetween(userIdA: string, userIdB: string): Promise<Conversation | null> {
    for (const conv of this.conversations.values()) {
      if (conv.type === '1:1') {
        const members = new Set(conv.memberIds);
        if (members.has(userIdA) && members.has(userIdB) && members.size === 2) {
          return conv;
        }
      }
    }
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
 * In-memory fake implementation of EventPublisher for testing.
 */
class FakeEventPublisher implements EventPublisher {
  private publishedEvents: Array<{ routingKey: string; payload: unknown }> = [];

  async publish(routingKey: string, payload: unknown): Promise<void> {
    this.publishedEvents.push({ routingKey, payload });
  }

  getPublishedEvents(): Array<{ routingKey: string; payload: unknown }> {
    return this.publishedEvents;
  }
}

describe('CreateOneToOneConversation Use Case', () => {
  let useCase: CreateOneToOneConversation;
  let conversationRepository: FakeConversationRepository;
  let eventPublisher: FakeEventPublisher;

  beforeEach(() => {
    conversationRepository = new FakeConversationRepository();
    eventPublisher = new FakeEventPublisher();
    useCase = new CreateOneToOneConversation(conversationRepository, eventPublisher);
  });

  describe('new 1:1 conversation created', () => {
    it('should create a new 1:1 conversation between two users', async () => {
      const result = await useCase.execute({
        requesterId: 'user-1',
        otherUserId: 'user-2',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.type).toBe('1:1');
        expect(result.value.memberIds).toContain('user-1');
        expect(result.value.memberIds).toContain('user-2');
        expect(result.value.memberIds).toHaveLength(2);

        // Verify it was persisted
        const persisted = await conversationRepository.findById(result.value.conversationId);
        expect(persisted).toBeDefined();
        expect(persisted?.type).toBe('1:1');
      }
    });

    it('should set the requester as the creator', async () => {
      const result = await useCase.execute({
        requesterId: 'alice',
        otherUserId: 'bob',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const persisted = await conversationRepository.findById(result.value.conversationId);
        expect(persisted?.createdBy).toBe('alice');
      }
    });
  });

  describe('existing 1:1 conversation reused', () => {
    it('should reuse an existing 1:1 conversation between the same two users', async () => {
      // Create the first conversation
      const result1 = await useCase.execute({
        requesterId: 'user-1',
        otherUserId: 'user-2',
      });

      expect(result1.isOk()).toBe(true);

      const convId1 = result1.isOk() ? result1.value.conversationId : '';

      // Attempt to create again
      const result2 = await useCase.execute({
        requesterId: 'user-1',
        otherUserId: 'user-2',
      });

      expect(result2.isOk()).toBe(true);
      if (result2.isOk()) {
        // Should return the same conversation ID
        expect(result2.value.conversationId).toBe(convId1);
      }
    });

    it('should reuse regardless of which user is the requester', async () => {
      // Create conversation as user-1
      const result1 = await useCase.execute({
        requesterId: 'user-1',
        otherUserId: 'user-2',
      });

      expect(result1.isOk()).toBe(true);
      const convId1 = result1.isOk() ? result1.value.conversationId : '';

      // Request as user-2 this time
      const result2 = await useCase.execute({
        requesterId: 'user-2',
        otherUserId: 'user-1',
      });

      expect(result2.isOk()).toBe(true);
      if (result2.isOk()) {
        expect(result2.value.conversationId).toBe(convId1);
      }
    });

    it('should not reuse a conversation with a third user', async () => {
      // Create conversation between user-1 and user-2
      const result1 = await useCase.execute({
        requesterId: 'user-1',
        otherUserId: 'user-2',
      });

      expect(result1.isOk()).toBe(true);
      const convId1 = result1.isOk() ? result1.value.conversationId : '';

      // Create conversation between user-1 and user-3
      const result2 = await useCase.execute({
        requesterId: 'user-1',
        otherUserId: 'user-3',
      });

      expect(result2.isOk()).toBe(true);
      if (result2.isOk()) {
        // Should be a different conversation
        expect(result2.value.conversationId).not.toBe(convId1);
      }
    });
  });

  describe('conversation timestamps', () => {
    it('should set the createdAt timestamp', async () => {
      const beforeTime = new Date();
      const result = await useCase.execute({
        requesterId: 'user-1',
        otherUserId: 'user-2',
      });
      const afterTime = new Date();

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.createdAt.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
        expect(result.value.createdAt.getTime()).toBeLessThanOrEqual(afterTime.getTime());
      }
    });
  });
});
