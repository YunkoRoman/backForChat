/**
 * Represents a membership record for a user in a conversation
 */
export interface MembershipRecord {
  conversationId: string;
  userId: string;
  lastReadMessageId: string | null;
}

/**
 * Repository interface for managing membership records
 */
export interface MembershipRepository {
  /**
   * Find a membership record by conversation ID and user ID
   * @param conversationId The conversation ID
   * @param userId The user ID
   * @returns The membership record if found, null otherwise
   */
  findByConversationAndUser(
    conversationId: string,
    userId: string,
  ): Promise<MembershipRecord | null>;

  /**
   * Update the lastReadMessageId for a membership
   * @param conversationId The conversation ID
   * @param userId The user ID
   * @param messageId The message ID to mark as read
   */
  updateLastReadMessageId(
    conversationId: string,
    userId: string,
    messageId: string,
  ): Promise<void>;
}
