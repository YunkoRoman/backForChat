import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LogoutUser } from './logout-user.use-case.js';
import { TokenService } from './ports/token-service.interface.js';
import { InvalidTokenError } from '../domain/errors.js';

/**
 * In-memory fake implementation of TokenService for testing.
 */
class FakeTokenService implements TokenService {
  private revokedTokens = new Set<string>();

  async issueTokens(
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    return {
      accessToken: `access_${userId}_1`,
      refreshToken: `refresh_${userId}_1`,
    };
  }

  async rotateRefreshToken(
    _refreshToken: string,
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
    throw new Error('Not implemented in this test');
  }

  async revokeAllSessions(_userId: string): Promise<void> {
    throw new Error('Not implemented in this test');
  }

  async revokeRefreshToken(refreshToken: string): Promise<void> {
    if (!refreshToken || refreshToken === 'invalid') {
      throw new InvalidTokenError();
    }
    this.revokedTokens.add(refreshToken);
  }

  async verifyAccessToken(_accessToken: string): Promise<string> {
    throw new Error('Not implemented in this test');
  }

  isTokenRevoked(token: string): boolean {
    return this.revokedTokens.has(token);
  }
}

describe('LogoutUser Use Case', () => {
  let logoutUser: LogoutUser;
  let tokenService: FakeTokenService;

  beforeEach(() => {
    tokenService = new FakeTokenService();
    logoutUser = new LogoutUser(tokenService);
  });

  describe('successful logout', () => {
    it('should revoke the refresh token', async () => {
      const refreshToken = 'refresh_user123_1';

      const result = await logoutUser.execute({
        refreshToken,
      });

      expect(result.isOk()).toBe(true);

      // Verify the token was actually revoked
      expect(tokenService.isTokenRevoked(refreshToken)).toBe(true);
    });

    it('should return empty response on successful logout', async () => {
      const result = await logoutUser.execute({
        refreshToken: 'refresh_user456_1',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        // Response should be an empty object
        expect(result.value).toEqual({});
      }
    });
  });

  describe('token revocation', () => {
    it('should prevent the revoked token from being used again', async () => {
      const refreshToken = 'refresh_user789_1';

      // First logout
      const result1 = await logoutUser.execute({
        refreshToken,
      });
      expect(result1.isOk()).toBe(true);

      // Verify token is revoked
      expect(tokenService.isTokenRevoked(refreshToken)).toBe(true);
    });
  });

  describe('idempotent logout', () => {
    it('should succeed even if token is invalid (idempotent)', async () => {
      // Try to logout with an invalid token
      const result = await logoutUser.execute({
        refreshToken: 'invalid',
      });

      // Should still return success (idempotent logout)
      expect(result.isOk()).toBe(true);
    });

    it('should succeed when logging out with empty token', async () => {
      // Try to logout with empty token
      const result = await logoutUser.execute({
        refreshToken: '',
      });

      // Should still return success (idempotent)
      expect(result.isOk()).toBe(true);
    });
  });

  describe('token service interaction', () => {
    it('should call TokenService.revokeRefreshToken', async () => {
      const revokeSpy = vi.spyOn(tokenService, 'revokeRefreshToken');

      const refreshToken = 'refresh_test_1';

      await logoutUser.execute({
        refreshToken,
      });

      expect(revokeSpy).toHaveBeenCalledWith(refreshToken);
      expect(revokeSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('multiple logouts', () => {
    it('should allow multiple logout calls (idempotent)', async () => {
      const refreshToken = 'refresh_user_multi_1';

      // First logout
      const result1 = await logoutUser.execute({
        refreshToken,
      });
      expect(result1.isOk()).toBe(true);

      // Second logout with same token - should still succeed
      const result2 = await logoutUser.execute({
        refreshToken,
      });
      expect(result2.isOk()).toBe(true);

      // Third logout - should still succeed
      const result3 = await logoutUser.execute({
        refreshToken,
      });
      expect(result3.isOk()).toBe(true);
    });
  });
});
