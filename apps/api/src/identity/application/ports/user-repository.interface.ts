import { Repository } from '../../../shared-kernel/repository.interface.js';
import { User } from '../../domain/user.aggregate.js';

export interface UserRepository extends Repository<User, string> {
  findByEmail(email: string): Promise<User | null>;
}
