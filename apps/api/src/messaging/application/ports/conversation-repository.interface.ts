import { Repository } from '../../../shared-kernel/index.js';
import { Conversation } from '../../domain/conversation.aggregate.js';

export interface ConversationRepository extends Repository<Conversation, string> {
  /**
   * Find a 1:1 conversation between two specific users.
   * @param userIdA First user ID
   * @param userIdB Second user ID
   * @returns The conversation if it exists, null otherwise
   */
  findOneToOneBetween(userIdA: string, userIdB: string): Promise<Conversation | null>;

  /**
   * Find all conversations a user is a member of.
   * @param userId The user ID
   * @returns Array of conversations the user is a member of
   */
  findAllForUser(userId: string): Promise<Conversation[]>;
}
