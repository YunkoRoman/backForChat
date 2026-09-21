import { Repository } from '../../../shared-kernel/index.js';
import { Message } from '../../domain/message.entity.js';

export interface MessageCursor {
  /** Optional message ID to start before (for pagination) */
  before?: string;
  /** Maximum number of messages to return */
  limit: number;
}

export interface MessagePage {
  /** Messages in reverse-chronological order (newest first) */
  messages: Message[];
  /** Cursor to fetch the next page, or null if no more pages */
  nextCursor: MessageCursor | null;
}

export interface MessageRepository extends Repository<Message, string> {
  /**
   * Find messages for a conversation with cursor-based pagination.
   * Returns messages in reverse-chronological order (newest first).
   * @param conversationId The conversation ID
   * @param cursor Pagination cursor with optional 'before' message ID and limit
   * @returns Messages and next cursor if more exist
   */
  findByConversationId(
    conversationId: string,
    cursor: MessageCursor,
  ): Promise<MessagePage>;

  /**
   * Find a message by its ID.
   * @param id The message ID
   * @returns The message if found, null otherwise
   */
  findById(id: string): Promise<Message | null>;
}
