import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RefreshSession } from './refresh-session.use-case.js';
import { TokenService } from './ports/token-service.interface.js';
import {
  TokenReuseDetectedError,
  InvalidTokenError,
} from '../domain/errors.js';

/**
 * In-memory fake implementation of TokenService for testing.
 */
class FakeTokenService implements TokenService {
  private validTokens = new Set<string>();
  private usedTokens = new Set<string>();
  private tokenCounter = 0;

  async issueTokens(
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    this.tokenCounter++;
    const refreshToken = `refresh_${userId}_${this.tokenCounter}`;
    this.validTokens.add(refreshToken);
    return {
      accessToken: `access_${userId}_${this.tokenCounter}`,
      refreshToken,
    };
  }

  async rotateRefreshToken(
    refreshToken: string,
  ): Promise<
    | {
        kind: 'success';
        accessToken: string;
        refreshToken: string;
        userId: string;
      }
    | {
        kind: 'reuse-detected';
        userId: string;
      }
  > {
    // Check if this token was already used
    if (this.usedTokens.has(refreshToken)) {
      // Extract userId from token format (fake, for testing)
      const userId = refreshToken.split('_')[1];
      return { kind: 'reuse-detected', userId };
    }

    // Check if token is valid
    if (!this.validTokens.has(refreshToken)) {
      throw new InvalidTokenError();
    }

    // Mark as used and remove from valid set
    this.validTokens.delete(refreshToken);
    this.usedTokens.add(refreshToken);

    // Issue new tokens
    this.tokenCounter++;
    const userId = refreshToken.split('_')[1];
    const newRefreshToken = `refresh_${userId}_${this.tokenCounter}`;
    this.validTokens.add(newRefreshToken);

    return {
      kind: 'success',
      accessToken: `access_${userId}_${this.tokenCounter}`,
      refreshToken: newRefreshToken,
      userId,
    };
  }

  async revokeAllSessions(userId: string): Promise<void> {
    // Invalidate all tokens for this user
    for (const token of this.validTokens) {
      if (token.includes(`_${userId}_`)) {
        this.validTokens.delete(token);
      }
    }
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    this.validTokens.delete(refreshToken);
    this.usedTokens.delete(refreshToken);
  }

  async verifyAccessToken(_accessToken: string): Promise<string> {
    throw new Error('Not implemented in this test');
  }
}

describe('RefreshSession Use Case', () => {
  let refreshSession: RefreshSession;
  let tokenService: FakeTokenService;

  beforeEach(() => {
    tokenService = new FakeTokenService();
    refreshSession = new RefreshSession(tokenService);
  });

  describe('successful refresh', () => {
    it('should rotate the refresh token and issue new tokens', async () => {
      // Issue initial tokens
      const tokens = await tokenService.issueTokens('user-123');

      // Refresh the session
      const result = await refreshSession.execute({
        refreshToken: tokens.refreshToken,
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.accessToken).toBeDefined();
        expect(result.value.refreshToken).toBeDefined();
        // New tokens should be different from old ones
        expect(result.value.refreshToken).not.toBe(tokens.refreshToken);
      }
    });

    it('should invalidate the old refresh token after rotation', async () => {
      // Issue initial tokens
      const tokens = await tokenService.issueTokens('user-456');

      // Refresh the session
      const result1 = await refreshSession.execute({
        refreshToken: tokens.refreshToken,
      });
      expect(result1.isOk()).toBe(true);

      // Try to use the old token again - should fail
      const result2 = await refreshSession.execute({
        refreshToken: tokens.refreshToken,
      });
      expect(result2.isErr()).toBe(true);
      if (result2.isErr()) {
        expect(result2.error).toBeInstanceOf(TokenReuseDetectedError);
      }
    });
  });

  describe('reuse detection and session revocation', () => {
    it('should detect when a refresh token is reused', async () => {
      // Issue initial tokens
      const tokens = await tokenService.issueTokens('user-789');

      // First refresh succeeds
      const result1 = await refreshSession.execute({
        refreshToken: tokens.refreshToken,
      });
      expect(result1.isOk()).toBe(true);

      if (result1.isOk()) {
        // Try to use the old token again (reuse attempt)
        const result2 = await refreshSession.execute({
          refreshToken: tokens.refreshToken,
        });

        // Should detect reuse and return error
        expect(result2.isErr()).toBe(true);
        if (result2.isErr()) {
          expect(result2.error).toBeInstanceOf(TokenReuseDetectedError);
        }
      }
    });

    it('should revoke all sessions when token reuse is detected', async () => {
      // Set up a spy on revokeAllSessions
      const revokeSpy = vi.spyOn(tokenService, 'revokeAllSessions');

      // Issue initial tokens
      const tokens = await tokenService.issueTokens('user-reuse-detection');

      // First refresh succeeds
      const result1 = await refreshSession.execute({
        refreshToken: tokens.refreshToken,
      });
      expect(result1.isOk()).toBe(true);

      if (result1.isOk()) {
        // Reset spy call count after first refresh
        revokeSpy.mockClear();

        // Try to use the old token again (reuse)
        const result2 = await refreshSession.execute({
          refreshToken: tokens.refreshToken,
        });

        // Should detect reuse
        expect(result2.isErr()).toBe(true);
        if (result2.isErr()) {
          expect(result2.error).toBeInstanceOf(TokenReuseDetectedError);
        }

        // Should have called revokeAllSessions
        expect(revokeSpy).toHaveBeenCalledWith('user-reuse-detection');
      }
    });
  });

  describe('invalid token handling', () => {
    it('should reject an invalid or expired token', async () => {
      const result = await refreshSession.execute({
        refreshToken: 'invalid_token_that_was_never_issued',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(InvalidTokenError);
      }
    });

    it('should reject an empty token', async () => {
      const result = await refreshSession.execute({
        refreshToken: '',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(InvalidTokenError);
      }
    });
  });

  describe('multiple rotations', () => {
    it('should allow multiple consecutive successful rotations', async () => {
      // Issue initial tokens
      let tokens = await tokenService.issueTokens('user-multiple');

      // Perform multiple rotations
      for (let i = 0; i < 3; i++) {
        const result = await refreshSession.execute({
          refreshToken: tokens.refreshToken,
        });

        expect(result.isOk()).toBe(true);
        if (result.isOk()) {
          tokens = {
            accessToken: result.value.accessToken,
            refreshToken: result.value.refreshToken,
          };
        }
      }

      // After 3 rotations, tokens should still be valid
      const finalResult = await refreshSession.execute({
        refreshToken: tokens.refreshToken,
      });
      expect(finalResult.isOk()).toBe(true);
    });
  });
});
