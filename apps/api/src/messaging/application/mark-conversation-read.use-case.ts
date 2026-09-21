import { Result, ok, err } from '../../shared-kernel/index.js';
import {
  RequesterNotAMemberError,
  MessageDoesNotBelongToConversationError,
} from '../domain/index.js';
import { ConversationRepository } from './ports/conversation-repository.interface.js';
import { MessageRepository } from './ports/message-repository.interface.js';
import { MembershipRepository } from './ports/membership-repository.interface.js';

export interface MarkConversationReadRequest {
  requesterId: string;
  conversationId: string;
  messageId: string;
}

export interface MarkConversationReadResponse {
  conversationId: string;
  userId: string;
  messageId: string;
}

export class MarkConversationRead {
  constructor(
    private conversationRepository: ConversationRepository,
    private messageRepository: MessageRepository,
    private membershipRepository: MembershipRepository,
  ) {}

  async execute(
    request: MarkConversationReadRequest,
  ): Promise<
    Result<
      MarkConversationReadResponse,
      RequesterNotAMemberError | MessageDoesNotBelongToConversationError
    >
  > {
    const { requesterId, conversationId, messageId } = request;

    // Fetch the conversation
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      return err(new RequesterNotAMemberError());
    }

    // Check if requester is a member
    if (!conversation.isMember(requesterId)) {
      return err(new RequesterNotAMemberError());
    }

    // Check if message belongs to this conversation
    const message = await this.messageRepository.findById(messageId);
    if (!message || message.conversationId !== conversationId) {
      return err(new MessageDoesNotBelongToConversationError());
    }

    // Update the membership's lastReadMessageId
    await this.membershipRepository.updateLastReadMessageId(conversationId, requesterId, messageId);

    return ok({
      conversationId,
      userId: requesterId,
      messageId,
    });
  }
}
