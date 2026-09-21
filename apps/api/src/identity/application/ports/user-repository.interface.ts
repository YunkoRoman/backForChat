import { Repository } from '../../../shared-kernel/repository.interface.js';
import { User } from '../../domain/user.aggregate.js';

export interface UserRepository extends Repository<User, string> {
  findByEmail(email: string): Promise<User | null>;

  /**
   * Find all users except the one with the given ID, with pagination
   * @param excludeUserId The user ID to exclude from results
   * @param limit Maximum number of users to return
   * @param offset Number of users to skip
   */
  findAllExcept(
    excludeUserId: string,
    limit: number,
    offset: number,
  ): Promise<{ users: User[]; total: number }>;
}
