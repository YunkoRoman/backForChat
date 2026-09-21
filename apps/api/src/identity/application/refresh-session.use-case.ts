import { Result, ok, err } from '../../shared-kernel/index.js';
import {
  TokenReuseDetectedError,
  InvalidTokenError,
} from '../domain/errors.js';
import { TokenService } from './ports/token-service.interface.js';

export interface RefreshSessionRequest {
  refreshToken: string;
}

export interface RefreshSessionResponse {
  accessToken: string;
  refreshToken: string;
}

export class RefreshSession {
  constructor(private tokenService: TokenService) {}

  async execute(
    request: RefreshSessionRequest,
  ): Promise<
    Result<RefreshSessionResponse, TokenReuseDetectedError | InvalidTokenError>
  > {
    try {
      // Ask TokenService to rotate the token
      const result = await this.tokenService.rotateRefreshToken(
        request.refreshToken,
      );

      if (result.kind === 'reuse-detected') {
        // Revoke all sessions for this user
        await this.tokenService.revokeAllSessions(result.userId);
        return err(new TokenReuseDetectedError());
      }

      // Success case
      return ok({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
    } catch (error) {
      // TokenService throws InvalidTokenError for invalid/expired tokens
      if (error instanceof InvalidTokenError) {
        return err(error);
      }
      // Re-throw unexpected errors
      throw error;
    }
  }
}
