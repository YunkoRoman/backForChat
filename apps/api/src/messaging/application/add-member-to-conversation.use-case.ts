import { Result, ok, err } from '../../shared-kernel/index.js';
import {
  RequesterNotAMemberError,
  CannotAddMemberToOneToOneConversationError,
} from '../domain/index.js';
import { ConversationRepository } from './ports/conversation-repository.interface.js';

export interface AddMemberToConversationRequest {
  requesterId: string;
  conversationId: string;
  newMemberId: string;
}

export interface AddMemberToConversationResponse {
  conversationId: string;
  memberIds: string[];
}

export class AddMemberToConversation {
  constructor(private conversationRepository: ConversationRepository) {}

  async execute(
    request: AddMemberToConversationRequest,
  ): Promise<
    Result<
      AddMemberToConversationResponse,
      RequesterNotAMemberError | CannotAddMemberToOneToOneConversationError
    >
  > {
    const { requesterId, conversationId, newMemberId } = request;

    // Fetch the conversation
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      return err(new RequesterNotAMemberError());
    }

    // Check if requester is a member
    if (!conversation.isMember(requesterId)) {
      return err(new RequesterNotAMemberError());
    }

    // Check if conversation is 1:1
    if (conversation.type === '1:1') {
      return err(new CannotAddMemberToOneToOneConversationError());
    }

    // Add the new member
    conversation.addMember(newMemberId);

    // Save the conversation
    await this.conversationRepository.save(conversation);

    return ok({
      conversationId: conversation.id,
      memberIds: conversation.memberIds,
    });
  }
}
