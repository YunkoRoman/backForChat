import { Controller, Get, Query, Req, BadRequestException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedRequest } from './types/authenticated-request.js';
import { ListUsers } from '../../application/index.js';
import { UserDto } from './dtos/user.dto.js';
import { MongooseUserRepository } from '../persistence/mongoose-user.repository.js';

export interface PaginatedUsersResponse {
  users: UserDto[];
  total: number;
  limit: number;
  offset: number;
}

@Controller('users')
export class UsersController {
  constructor(
    private listUsersUseCase: ListUsers,
    private userRepository: MongooseUserRepository,
  ) {}

  /**
   * Get the currently authenticated user's own profile.
   * Lets the frontend resolve `who am I` after a silent token refresh,
   * which returns only a new access token, not user details.
   */
  @Get('me')
  async me(@Req() req: AuthenticatedRequest): Promise<UserDto> {
    if (!req.user?.id) {
      throw new BadRequestException('User ID not found in request');
    }

    const user = await this.userRepository.findById(req.user.id);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email.value,
      displayName: user.displayName,
      createdAt: user.createdAt,
    };
  }

  /**
   * Get a paginated list of registered users, excluding the requester
   * @param req Authenticated request (user ID derived from token)
   * @param limit Maximum number of users to return (default 20, max 100)
   * @param offset Number of users to skip (default 0)
   */
  @Get()
  async list(
    @Req() req: AuthenticatedRequest,
    @Query('limit') limitParam?: string,
    @Query('offset') offsetParam?: string,
  ): Promise<PaginatedUsersResponse> {
    if (!req.user?.id) {
      throw new BadRequestException('User ID not found in request');
    }

    // Parse and validate pagination parameters
    let limit = 20; // Default
    let offset = 0; // Default

    if (limitParam) {
      const parsed = parseInt(limitParam, 10);
      if (isNaN(parsed) || parsed < 1) {
        throw new BadRequestException('limit must be a positive integer');
      }
      if (parsed > 100) {
        limit = 100; // Cap at 100
      } else {
        limit = parsed;
      }
    }

    if (offsetParam) {
      const parsed = parseInt(offsetParam, 10);
      if (isNaN(parsed) || parsed < 0) {
        throw new BadRequestException('offset must be a non-negative integer');
      }
      offset = parsed;
    }

    const result = await this.listUsersUseCase.execute({
      requesterUserId: req.user.id,
      limit,
      offset,
    });

    if (!result.isOk()) {
      throw new BadRequestException('Failed to list users');
    }

    const response = result.value;
    return {
      users: response.users.map((user) => ({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
      })),
      total: response.total,
      limit: response.limit,
      offset: response.offset,
    };
  }
}
