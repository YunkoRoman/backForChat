import { describe, it, expect, beforeEach } from 'vitest';
import { AddMemberToConversation } from './add-member-to-conversation.use-case.js';
import { ConversationRepository } from './ports/conversation-repository.interface.js';
import { EventPublisher } from '../../shared-kernel/index.js';
import { Conversation } from '../domain/conversation.aggregate.js';
import {
  RequesterNotAMemberError,
  CannotAddMemberToOneToOneConversationError,
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

describe('AddMemberToConversation Use Case', () => {
  let useCase: AddMemberToConversation;
  let conversationRepository: FakeConversationRepository;
  let eventPublisher: FakeEventPublisher;

  beforeEach(() => {
    conversationRepository = new FakeConversationRepository();
    eventPublisher = new FakeEventPublisher();
    useCase = new AddMemberToConversation(conversationRepository, eventPublisher);
  });

  describe('member added to group', () => {
    it('should add a new member to a group conversation', async () => {
      // Create a group conversation
      const groupConv = Conversation.createGroup(
        'conv-1',
        'Team',
        ['user-1', 'user-2'],
        'user-1',
      );
      await conversationRepository.save(groupConv);

      const result = await useCase.execute({
        requesterId: 'user-1',
        conversationId: 'conv-1',
        newMemberId: 'user-3',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.memberIds).toContain('user-3');
        expect(result.value.memberIds).toHaveLength(3);
      }

      // Verify persistence
      const updated = await conversationRepository.findById('conv-1');
      expect(updated?.isMember('user-3')).toBe(true);
    });

    it('should allow any group member to add a new member', async () => {
      const groupConv = Conversation.createGroup(
        'conv-1',
        'Team',
        ['user-1', 'user-2'],
        'user-1',
      );
      await conversationRepository.save(groupConv);

      // User-2 (not the creator) adds user-3
      const result = await useCase.execute({
        requesterId: 'user-2',
        conversationId: 'conv-1',
        newMemberId: 'user-3',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.memberIds).toContain('user-3');
      }
    });

    it('should not duplicate a member that already exists', async () => {
      const groupConv = Conversation.createGroup(
        'conv-1',
        'Team',
        ['user-1', 'user-2'],
        'user-1',
      );
      await conversationRepository.save(groupConv);

      // Try to add user-2 again
      const result = await useCase.execute({
        requesterId: 'user-1',
        conversationId: 'conv-1',
        newMemberId: 'user-2',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.memberIds).toEqual(['user-1', 'user-2']);
      }
    });
  });

  describe('adding a member to a 1:1 conversation rejected', () => {
    it('should reject adding a third person to a 1:1 conversation', async () => {
      const oneToOneConv = Conversation.createOneToOne('conv-1', 'user-1', 'user-2', 'user-1');
      await conversationRepository.save(oneToOneConv);

      const result = await useCase.execute({
        requesterId: 'user-1',
        conversationId: 'conv-1',
        newMemberId: 'user-3',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(CannotAddMemberToOneToOneConversationError);
      }

      // Verify conversation was not modified
      const unchanged = await conversationRepository.findById('conv-1');
      expect(unchanged?.memberIds).toEqual(['user-1', 'user-2']);
    });
  });

  describe('non-member cannot add others', () => {
    it('should reject adding a member if requester is not a member', async () => {
      const groupConv = Conversation.createGroup(
        'conv-1',
        'Team',
        ['user-1', 'user-2'],
        'user-1',
      );
      await conversationRepository.save(groupConv);

      const result = await useCase.execute({
        requesterId: 'user-3',
        conversationId: 'conv-1',
        newMemberId: 'user-4',
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
        newMemberId: 'user-2',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(RequesterNotAMemberError);
      }
    });
  });
});
