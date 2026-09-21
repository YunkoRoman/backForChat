import { Result, ok } from '../../shared-kernel/index.js';
import { Conversation } from '../domain/conversation.aggregate.js';
import { ConversationRepository } from './ports/conversation-repository.interface.js';
import { randomUUID } from 'node:crypto';

export interface CreateOneToOneConversationRequest {
  requesterId: string;
  otherUserId: string;
}

export interface CreateOneToOneConversationResponse {
  conversationId: string;
  type: '1:1';
  memberIds: string[];
  createdAt: Date;
}

export class CreateOneToOneConversation {
  constructor(private conversationRepository: ConversationRepository) {}

  async execute(
    request: CreateOneToOneConversationRequest,
  ): Promise<Result<CreateOneToOneConversationResponse>> {
    const { requesterId, otherUserId } = request;

    // Try to find an existing 1:1 conversation between the two users
    const existing = await this.conversationRepository.findOneToOneBetween(
      requesterId,
      otherUserId,
    );

    if (existing) {
      return ok({
        conversationId: existing.id,
        type: '1:1',
        memberIds: existing.memberIds,
        createdAt: existing.createdAt,
      });
    }

    // Create a new 1:1 conversation
    const conversationId = randomUUID();
    const conversation = Conversation.createOneToOne(
      conversationId,
      requesterId,
      otherUserId,
      requesterId,
    );

    // Persist the conversation
    await this.conversationRepository.save(conversation);

    return ok({
      conversationId: conversation.id,
      type: '1:1',
      memberIds: conversation.memberIds,
      createdAt: conversation.createdAt,
    });
  }
}
