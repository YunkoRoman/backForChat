import { Result, ok } from '../../shared-kernel/index.js';
import { User } from '../domain/user.aggregate.js';
import { UserRepository } from './ports/user-repository.interface.js';

export interface ListUsersRequest {
  requesterUserId: string;
  limit: number;
  offset: number;
}

export interface ListUsersResponse {
  users: {
    id: string;
    email: string;
    displayName: string;
    createdAt: Date;
  }[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * List other registered users, paginated, excluding the requester
 */
export class ListUsers {
  constructor(private userRepository: UserRepository) {}

  async execute(request: ListUsersRequest): Promise<Result<ListUsersResponse>> {
    const { users, total } = await this.userRepository.findAllExcept(
      request.requesterUserId,
      request.limit,
      request.offset,
    );

    return ok({
      users: users.map((user: User) => ({
        id: user.id,
        email: user.email.value,
        displayName: user.displayName,
        createdAt: user.createdAt,
      })),
      total,
      limit: request.limit,
      offset: request.offset,
    });
  }
}
