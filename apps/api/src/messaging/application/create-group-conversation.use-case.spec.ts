import { describe, it, expect, beforeEach } from 'vitest';
import { CreateGroupConversation } from './create-group-conversation.use-case.js';
import { ConversationRepository } from './ports/conversation-repository.interface.js';
import { EventPublisher } from '../../shared-kernel/index.js';
import { Conversation } from '../domain/conversation.aggregate.js';
import { GroupMustHaveAtLeastTwoMembersError } from '../domain/errors.js';

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

describe('CreateGroupConversation Use Case', () => {
  let useCase: CreateGroupConversation;
  let conversationRepository: FakeConversationRepository;
  let eventPublisher: FakeEventPublisher;

  beforeEach(() => {
    conversationRepository = new FakeConversationRepository();
    eventPublisher = new FakeEventPublisher();
    useCase = new CreateGroupConversation(conversationRepository, eventPublisher);
  });

  describe('group conversation created', () => {
    it('should create a group with a creator and at least one other member', async () => {
      const result = await useCase.execute({
        creatorId: 'user-1',
        name: 'Project Team',
        memberIds: ['user-1', 'user-2', 'user-3'],
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.type).toBe('group');
        expect(result.value.name).toBe('Project Team');
        expect(result.value.memberIds).toContain('user-1');
        expect(result.value.memberIds).toContain('user-2');
        expect(result.value.memberIds).toContain('user-3');
        expect(result.value.memberIds).toHaveLength(3);
      }
    });

    it('should create a group with exactly 2 members (creator + 1)', async () => {
      const result = await useCase.execute({
        creatorId: 'user-1',
        name: 'Two-Person Group',
        memberIds: ['user-1', 'user-2'],
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.type).toBe('group');
        expect(result.value.memberIds).toHaveLength(2);
      }
    });

    it('should persist the created group', async () => {
      const result = await useCase.execute({
        creatorId: 'user-1',
        name: 'Team',
        memberIds: ['user-1', 'user-2'],
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const persisted = await conversationRepository.findById(result.value.conversationId);
        expect(persisted).toBeDefined();
        expect(persisted?.type).toBe('group');
        expect(persisted?.name).toBe('Team');
      }
    });

    it('should set the creator correctly', async () => {
      const result = await useCase.execute({
        creatorId: 'alice',
        name: 'Team',
        memberIds: ['alice', 'bob'],
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const persisted = await conversationRepository.findById(result.value.conversationId);
        expect(persisted?.createdBy).toBe('alice');
      }
    });
  });

  describe('group creation with too few members rejected', () => {
    it('should reject a group with no other members (only creator)', async () => {
      const result = await useCase.execute({
        creatorId: 'user-1',
        name: 'Solo Group',
        memberIds: ['user-1'],
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(GroupMustHaveAtLeastTwoMembersError);
      }
    });

    it('should reject a group with an empty member list', async () => {
      const result = await useCase.execute({
        creatorId: 'user-1',
        name: 'Empty Group',
        memberIds: [],
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(GroupMustHaveAtLeastTwoMembersError);
      }
    });
  });

  describe('group names', () => {
    it('should store the group name', async () => {
      const result = await useCase.execute({
        creatorId: 'user-1',
        name: 'Q4 Planning',
        memberIds: ['user-1', 'user-2', 'user-3'],
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.name).toBe('Q4 Planning');
      }
    });
  });

  describe('conversation timestamps', () => {
    it('should set the createdAt timestamp', async () => {
      const beforeTime = new Date();
      const result = await useCase.execute({
        creatorId: 'user-1',
        name: 'Team',
        memberIds: ['user-1', 'user-2'],
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
