import { Result, ok, err, EventPublisher } from '../../shared-kernel/index.js';
import {
  Conversation,
  GroupMustHaveAtLeastTwoMembersError,
} from '../domain/index.js';
import { ConversationRepository } from './ports/conversation-repository.interface.js';
import { randomUUID } from 'node:crypto';

export interface CreateGroupConversationRequest {
  creatorId: string;
  name: string;
  memberIds: string[]; // Should include creator
}

export interface CreateGroupConversationResponse {
  conversationId: string;
  type: 'group';
  name: string;
  memberIds: string[];
  createdAt: Date;
}

export class CreateGroupConversation {
  constructor(
    private conversationRepository: ConversationRepository,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(
    request: CreateGroupConversationRequest,
  ): Promise<Result<CreateGroupConversationResponse, GroupMustHaveAtLeastTwoMembersError>> {
    const { creatorId, name, memberIds } = request;

    try {
      const conversationId = randomUUID();
      const conversation = Conversation.createGroup(
        conversationId,
        name,
        memberIds,
        creatorId,
      );

      // Persist the conversation
      await this.conversationRepository.save(conversation);

      // Publish the conversation.created event (after persistence succeeds)
      await this.eventPublisher.publish('conversation.created', {
        conversationId: conversation.id,
        type: 'group',
        name: conversation.name,
        memberIds: conversation.memberIds,
        createdAt: conversation.createdAt.toISOString(),
      });

      return ok({
        conversationId: conversation.id,
        type: 'group',
        name: conversation.name!,
        memberIds: conversation.memberIds,
        createdAt: conversation.createdAt,
      });
    } catch (error) {
      if (error instanceof GroupMustHaveAtLeastTwoMembersError) {
        return err(error);
      }
      throw error;
    }
  }
}
