import { Result, ok } from '../../shared-kernel/index.js';
import { Conversation } from '../domain/conversation.aggregate.js';
import { ConversationRepository } from './ports/conversation-repository.interface.js';

export interface ListConversationsRequest {
  requesterId: string;
}

export interface ListConversationsResponse {
  conversations: {
    conversationId: string;
    type: '1:1' | 'group';
    name: string | null;
    memberIds: string[];
    createdAt: Date;
  }[];
}

/**
 * List the conversations the requester is a member of.
 */
export class ListConversations {
  constructor(private conversationRepository: ConversationRepository) {}

  async execute(
    request: ListConversationsRequest,
  ): Promise<Result<ListConversationsResponse>> {
    const conversations = await this.conversationRepository.findAllForUser(
      request.requesterId,
    );

    return ok({
      conversations: conversations.map((conversation: Conversation) => ({
        conversationId: conversation.id,
        type: conversation.type,
        name: conversation.name,
        memberIds: conversation.memberIds,
        createdAt: conversation.createdAt,
      })),
    });
  }
}
