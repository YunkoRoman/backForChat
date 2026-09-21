import { Result, ok, err } from '../../shared-kernel/index.js';
import { Message, RequesterNotAMemberError } from '../domain/index.js';
import { ConversationRepository } from './ports/conversation-repository.interface.js';
import { MessageRepository, MessageCursor } from './ports/message-repository.interface.js';

export interface GetMessageHistoryRequest {
  requesterId: string;
  conversationId: string;
  cursor: MessageCursor;
}

export interface GetMessageHistoryResponse {
  messages: Array<{
    messageId: string;
    senderId: string;
    text: string;
    createdAt: Date;
  }>;
  nextCursor: MessageCursor | null;
}

export class GetMessageHistory {
  constructor(
    private conversationRepository: ConversationRepository,
    private messageRepository: MessageRepository,
  ) {}

  async execute(
    request: GetMessageHistoryRequest,
  ): Promise<Result<GetMessageHistoryResponse, RequesterNotAMemberError>> {
    const { requesterId, conversationId, cursor } = request;

    // Fetch the conversation
    const conversation = await this.conversationRepository.findById(conversationId);
    if (!conversation) {
      return err(new RequesterNotAMemberError());
    }

    // Check if requester is a member
    if (!conversation.isMember(requesterId)) {
      return err(new RequesterNotAMemberError());
    }

    // Fetch messages with pagination
    const page = await this.messageRepository.findByConversationId(conversationId, cursor);

    return ok({
      messages: page.messages.map((message: Message) => ({
        messageId: message.id,
        senderId: message.senderId,
        text: message.text,
        createdAt: message.createdAt,
      })),
      nextCursor: page.nextCursor,
    });
  }
}
