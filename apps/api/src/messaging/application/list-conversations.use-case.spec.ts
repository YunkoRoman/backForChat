import { describe, it, expect, beforeEach } from 'vitest';
import { ListConversations } from './list-conversations.use-case.js';
import { ConversationRepository } from './ports/conversation-repository.interface.js';
import { Conversation } from '../domain/conversation.aggregate.js';

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
      if (conv.isMember(userId)) result.push(conv);
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

describe('ListConversations Use Case', () => {
  let useCase: ListConversations;
  let repository: FakeConversationRepository;

  beforeEach(() => {
    repository = new FakeConversationRepository();
    useCase = new ListConversations(repository);
  });

  it("returns only the requester's conversations", async () => {
    await repository.save(
      Conversation.createOneToOne('conv-1', 'alice', 'bob', 'alice'),
    );
    await repository.save(
      Conversation.createOneToOne('conv-2', 'carol', 'dave', 'carol'),
    );
    await repository.save(
      Conversation.createGroup('conv-3', 'Team', ['alice', 'carol'], 'alice'),
    );

    const result = await useCase.execute({ requesterId: 'alice' });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      const ids = result.value.conversations.map((c) => c.conversationId);
      expect(ids.sort()).toEqual(['conv-1', 'conv-3']);
    }
  });

  it('returns an empty list when the requester has no conversations', async () => {
    const result = await useCase.execute({ requesterId: 'nobody' });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.conversations).toEqual([]);
    }
  });
});
