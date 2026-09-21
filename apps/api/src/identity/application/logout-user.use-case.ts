import { Result, ok } from '../../shared-kernel/index.js';
import { InvalidTokenError } from '../domain/errors.js';
import { TokenService } from './ports/token-service.interface.js';

export interface LogoutUserRequest {
  refreshToken: string;
}

export interface LogoutUserResponse {
  // Empty response on successful logout
}

export class LogoutUser {
  constructor(private tokenService: TokenService) {}

  async execute(
    request: LogoutUserRequest,
  ): Promise<Result<LogoutUserResponse, InvalidTokenError>> {
    try {
      // Revoke the refresh token
      await this.tokenService.revokeRefreshToken(request.refreshToken);
      return ok({});
    } catch (error) {
      // If the token is invalid or doesn't exist, we still treat it as success
      // (idempotent logout - logging out twice should not error)
      if (error instanceof InvalidTokenError) {
        return ok({});
      }
      // Re-throw unexpected errors
      throw error;
    }
  }
}
