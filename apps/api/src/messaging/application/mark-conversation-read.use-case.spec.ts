import { describe, it, expect, beforeEach } from 'vitest';
import { MarkConversationRead } from './mark-conversation-read.use-case.js';
import { ConversationRepository } from './ports/conversation-repository.interface.js';
import { MessageRepository, MessageCursor } from './ports/message-repository.interface.js';
import { MembershipRepository, MembershipRecord } from './ports/membership-repository.interface.js';
import { Conversation } from '../domain/conversation.aggregate.js';
import { Message } from '../domain/message.entity.js';
import {
  RequesterNotAMemberError,
  MessageDoesNotBelongToConversationError,
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

/**
 * In-memory fake implementation of MembershipRepository for testing.
 */
class FakeMembershipRepository implements MembershipRepository {
  private memberships = new Map<string, MembershipRecord>();

  private getKey(conversationId: string, userId: string): string {
    return `${conversationId}:${userId}`;
  }

  async findByConversationAndUser(
    conversationId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    return this.memberships.get(this.getKey(conversationId, userId)) ?? null;
  }

  async updateLastReadMessageId(
    conversationId: string,
    userId: string,
    messageId: string,
  ): Promise<void> {
    const key = this.getKey(conversationId, userId);
    const existing = this.memberships.get(key);
    if (existing) {
      this.memberships.set(key, {
        ...existing,
        lastReadMessageId: messageId,
      });
    }
  }

  // Test helper to set up membership
  setupMembership(conversationId: string, userId: string): void {
    const key = this.getKey(conversationId, userId);
    this.memberships.set(key, {
      conversationId,
      userId,
      lastReadMessageId: null,
    });
  }
}

describe('MarkConversationRead Use Case', () => {
  let useCase: MarkConversationRead;
  let conversationRepository: FakeConversationRepository;
  let messageRepository: FakeMessageRepository;
  let membershipRepository: FakeMembershipRepository;

  beforeEach(() => {
    conversationRepository = new FakeConversationRepository();
    messageRepository = new FakeMessageRepository();
    membershipRepository = new FakeMembershipRepository();
    useCase = new MarkConversationRead(
      conversationRepository,
      messageRepository,
      membershipRepository,
    );
  });

  describe('Member marks conversation read', () => {
    it('should mark a conversation as read when message belongs to it', async () => {
      const conv = Conversation.createGroup('conv-1', 'Team', ['user-1', 'user-2'], 'user-1');
      await conversationRepository.save(conv);

      const message = Message.create('msg-1', 'conv-1', 'user-2', 'Hello there');
      await messageRepository.save(message);

      // Set up membership
      membershipRepository.setupMembership('conv-1', 'user-1');

      const result = await useCase.execute({
        requesterId: 'user-1',
        conversationId: 'conv-1',
        messageId: 'msg-1',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.conversationId).toBe('conv-1');
        expect(result.value.userId).toBe('user-1');
        expect(result.value.messageId).toBe('msg-1');

        // Verify persistence
        const membership = await membershipRepository.findByConversationAndUser('conv-1', 'user-1');
        expect(membership?.lastReadMessageId).toBe('msg-1');
      }
    });

    it('should update lastReadMessageId to a newer message', async () => {
      const conv = Conversation.createGroup('conv-1', 'Team', ['user-1', 'user-2'], 'user-1');
      await conversationRepository.save(conv);

      const message1 = Message.create('msg-1', 'conv-1', 'user-2', 'First message');
      const message2 = Message.create('msg-2', 'conv-1', 'user-2', 'Second message');
      await messageRepository.save(message1);
      await messageRepository.save(message2);

      // Set up membership with initial read position
      membershipRepository.setupMembership('conv-1', 'user-1');

      // Mark first message as read
      await useCase.execute({
        requesterId: 'user-1',
        conversationId: 'conv-1',
        messageId: 'msg-1',
      });

      // Now mark second message as read
      const result = await useCase.execute({
        requesterId: 'user-1',
        conversationId: 'conv-1',
        messageId: 'msg-2',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        const membership = await membershipRepository.findByConversationAndUser('conv-1', 'user-1');
        expect(membership?.lastReadMessageId).toBe('msg-2');
      }
    });
  });

  describe('Non-member cannot mark as read', () => {
    it('should reject if requester is not a member of the conversation', async () => {
      const conv = Conversation.createGroup('conv-1', 'Team', ['user-1', 'user-2'], 'user-1');
      await conversationRepository.save(conv);

      const message = Message.create('msg-1', 'conv-1', 'user-2', 'Hello there');
      await messageRepository.save(message);

      const result = await useCase.execute({
        requesterId: 'user-3', // Not a member
        conversationId: 'conv-1',
        messageId: 'msg-1',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(RequesterNotAMemberError);
      }
    });

    it('should reject if conversation does not exist', async () => {
      const result = await useCase.execute({
        requesterId: 'user-1',
        conversationId: 'nonexistent-conv',
        messageId: 'msg-1',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(RequesterNotAMemberError);
      }
    });
  });

  describe('Message must belong to conversation', () => {
    it('should reject if message does not belong to the conversation', async () => {
      const conv1 = Conversation.createGroup('conv-1', 'Team A', ['user-1', 'user-2'], 'user-1');
      const conv2 = Conversation.createGroup('conv-2', 'Team B', ['user-1', 'user-3'], 'user-1');
      await conversationRepository.save(conv1);
      await conversationRepository.save(conv2);

      // Create message in a different conversation
      const message = Message.create('msg-1', 'conv-2', 'user-3', 'Message in conv-2');
      await messageRepository.save(message);

      membershipRepository.setupMembership('conv-1', 'user-1');

      const result = await useCase.execute({
        requesterId: 'user-1',
        conversationId: 'conv-1', // Trying to read a message from conv-2
        messageId: 'msg-1',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(MessageDoesNotBelongToConversationError);
      }
    });

    it('should reject if message does not exist', async () => {
      const conv = Conversation.createGroup('conv-1', 'Team', ['user-1', 'user-2'], 'user-1');
      await conversationRepository.save(conv);

      membershipRepository.setupMembership('conv-1', 'user-1');

      const result = await useCase.execute({
        requesterId: 'user-1',
        conversationId: 'conv-1',
        messageId: 'nonexistent-msg',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(MessageDoesNotBelongToConversationError);
      }
    });
  });
});
