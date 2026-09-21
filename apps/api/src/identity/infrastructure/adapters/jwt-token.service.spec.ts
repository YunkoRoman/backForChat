import { describe, it, expect, beforeEach } from 'vitest';
import { JwtService } from '@nestjs/jwt';
import { JwtTokenService } from './jwt-token.service.js';
import { InvalidTokenError } from '../../domain/errors.js';
import type {
  RefreshTokenRecord,
  RefreshTokenRepository,
} from '../persistence/refresh-token.repository.js';
import type { ConfigService } from '../../../config/config.service.js';

class FakeRefreshTokenRepository {
  private records = new Map<string, RefreshTokenRecord>();

  async save(record: RefreshTokenRecord): Promise<void> {
    this.records.set(record.id, record);
  }

  async findById(id: string): Promise<RefreshTokenRecord | null> {
    return this.records.get(id) ?? null;
  }

  async markAsReplaced(tokenId: string, replacedByTokenId: string): Promise<void> {
    const record = this.records.get(tokenId);
    if (record) record.replacedByTokenId = replacedByTokenId;
  }

  async revokeAllForUser(userId: string): Promise<void> {
    for (const [id, record] of this.records) {
      if (record.userId === userId) this.records.delete(id);
    }
  }

  async revoke(tokenId: string): Promise<void> {
    this.records.delete(tokenId);
  }

  async deleteExpired(): Promise<void> {
    // not exercised in these tests
  }
}

const fakeConfig = {
  jwtAccessSecret: 'test-access-secret',
  jwtRefreshSecret: 'test-refresh-secret',
} as unknown as ConfigService;

describe('JwtTokenService', () => {
  let repo: FakeRefreshTokenRepository;
  let service: JwtTokenService;

  beforeEach(() => {
    repo = new FakeRefreshTokenRepository();
    service = new JwtTokenService(
      new JwtService(),
      fakeConfig,
      repo as unknown as RefreshTokenRepository,
    );
  });

  it('issues an access and refresh token pair and stores the refresh token hashed, not plaintext', async () => {
    const { accessToken, refreshToken } = await service.issueTokens('user-1');
    expect(accessToken).toBeTruthy();
    expect(refreshToken).toBeTruthy();

    const stored = [...(repo as any).records.values()][0] as RefreshTokenRecord;
    expect(stored.tokenHash).not.toBe(refreshToken);
    expect(stored.userId).toBe('user-1');
  });

  it('verifies a freshly issued access token and returns the user id', async () => {
    const { accessToken } = await service.issueTokens('user-42');
    const userId = await service.verifyAccessToken(accessToken);
    expect(userId).toBe('user-42');
  });

  it('rejects a malformed access token', async () => {
    await expect(service.verifyAccessToken('not.a.jwt')).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it('rejects an expired access token', async () => {
    const jwt = new JwtService();
    const expired = jwt.sign(
      { sub: 'user-1' },
      { secret: 'test-access-secret', expiresIn: -10, jwtid: 'expired-jti' },
    );

    await expect(service.verifyAccessToken(expired)).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it('rotates a valid refresh token into a new access/refresh pair', async () => {
    const { refreshToken } = await service.issueTokens('user-7');
    const result = await service.rotateRefreshToken(refreshToken);

    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.userId).toBe('user-7');
      expect(result.refreshToken).not.toBe(refreshToken);
    }
  });

  it('detects reuse of an already-rotated refresh token and revokes all sessions', async () => {
    const { refreshToken } = await service.issueTokens('user-9');

    // First rotation succeeds and marks the original token as replaced
    await service.rotateRefreshToken(refreshToken);

    // Presenting the same (now-rotated) token again must be detected as reuse
    const reuseResult = await service.rotateRefreshToken(refreshToken);
    expect(reuseResult.kind).toBe('reuse-detected');
    if (reuseResult.kind === 'reuse-detected') {
      expect(reuseResult.userId).toBe('user-9');
    }

    // All sessions for the user should be gone after reuse detection
    const remaining = [...(repo as any).records.values()].filter(
      (r: RefreshTokenRecord) => r.userId === 'user-9',
    );
    expect(remaining.length).toBe(0);
  });

  it('rejects rotating a refresh token that was never issued', async () => {
    const jwt = new JwtService();
    const foreignToken = jwt.sign(
      { sub: 'user-1' },
      { secret: 'test-refresh-secret', expiresIn: 60, jwtid: 'unknown-jti' },
    );

    await expect(service.rotateRefreshToken(foreignToken)).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it('revoking a refresh token makes it unusable', async () => {
    const { refreshToken } = await service.issueTokens('user-3');
    await service.revokeRefreshToken(refreshToken);

    await expect(service.rotateRefreshToken(refreshToken)).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it('revoking an already-invalid refresh token does not throw (idempotent)', async () => {
    await expect(service.revokeRefreshToken('garbage')).resolves.toBeUndefined();
  });
});
