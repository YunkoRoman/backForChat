import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { TokenService } from '../../application/ports/token-service.interface.js';
import { ConfigService } from '../../../config/config.service.js';
import { InvalidTokenError } from '../../domain/errors.js';
import { RefreshTokenRepository } from '../persistence/refresh-token.repository.js';
import { TokenCryptoUtil } from './token-crypto.util.js';

/**
 * JWT Token Service Adapter
 *
 * Implements the TokenService port using @nestjs/jwt for signing and verifying.
 *
 * Token Strategy:
 * - Access Token: 15 minutes expiry, used for API requests
 * - Refresh Token: 7 days expiry, can be rotated to extend session
 *
 * Refresh Token Rotation & Reuse Detection:
 * 1. Tokens are signed with a unique jti (JWT ID) claim
 * 2. The refresh token itself is hashed (SHA-256) before storage
 * 3. When a refresh token is rotated:
 *    - The old token's record is marked with replacedByTokenId
 *    - A new token is issued with a new jti
 * 4. If a client reuses an already-rotated token:
 *    - We detect it has a replacedByTokenId set
 *    - We revoke ALL sessions for that user (security breach indicator)
 */
@Injectable()
export class JwtTokenService implements TokenService {
  // Access token expiry: 15 minutes
  private readonly accessTokenExpirySeconds = 15 * 60;

  // Refresh token expiry: 7 days
  private readonly refreshTokenExpirySeconds = 7 * 24 * 60 * 60;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private refreshTokenRepository: RefreshTokenRepository,
  ) {}

  /**
   * Issue a new access token and refresh token pair
   */
  async issueTokens(userId: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // Generate unique IDs for both tokens
    const accessTokenJti = randomUUID();
    const refreshTokenJti = randomUUID();

    // Sign the access token
    const accessToken = this.jwtService.sign(
      { sub: userId },
      {
        secret: this.configService.jwtAccessSecret,
        expiresIn: this.accessTokenExpirySeconds,
        jwtid: accessTokenJti,
      },
    );

    // Sign the refresh token (actual token returned to client)
    const refreshToken = this.jwtService.sign(
      { sub: userId },
      {
        secret: this.configService.jwtRefreshSecret,
        expiresIn: this.refreshTokenExpirySeconds,
        jwtid: refreshTokenJti,
      },
    );

    // Hash and store the refresh token
    const tokenHash = TokenCryptoUtil.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + this.refreshTokenExpirySeconds * 1000);

    await this.refreshTokenRepository.save({
      id: refreshTokenJti,
      userId,
      tokenHash,
      expiresAt,
    });

    return { accessToken, refreshToken };
  }

  /**
   * Rotate a refresh token, issuing new access and refresh tokens
   *
   * This implements reuse detection:
   * - If the presented token was already rotated (has replacedByTokenId set),
   *   we revoke all sessions for this user (security breach indicator)
   * - Otherwise, we issue new tokens and mark the old one as replaced
   */
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
    let payload;
    try {
      // Verify the token signature and extract the jti
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.jwtRefreshSecret,
      });
    } catch {
      throw new InvalidTokenError();
    }

    const refreshTokenJti = payload.jti;
    const userId = payload.sub;

    // Look up the stored token record
    const tokenRecord = await this.refreshTokenRepository.findById(refreshTokenJti);
    if (!tokenRecord) {
      throw new InvalidTokenError();
    }

    // Verify the token hash matches what we stored
    if (!TokenCryptoUtil.verifyTokenHash(refreshToken, tokenRecord.tokenHash)) {
      throw new InvalidTokenError();
    }

    // Check if this token was already rotated (reuse detection)
    if (tokenRecord.replacedByTokenId) {
      // This token was already exchanged once before - it's being reused
      // This indicates a security breach (token leak)
      // Revoke all sessions for this user
      await this.revokeAllSessions(userId);
      return {
        kind: 'reuse-detected',
        userId,
      };
    }

    // Issue new tokens
    const newAccessTokenJti = randomUUID();
    const newRefreshTokenJti = randomUUID();

    const newAccessToken = this.jwtService.sign(
      { sub: userId },
      {
        secret: this.configService.jwtAccessSecret,
        expiresIn: this.accessTokenExpirySeconds,
        jwtid: newAccessTokenJti,
      },
    );

    const newRefreshToken = this.jwtService.sign(
      { sub: userId },
      {
        secret: this.configService.jwtRefreshSecret,
        expiresIn: this.refreshTokenExpirySeconds,
        jwtid: newRefreshTokenJti,
      },
    );

    // Mark the old token as replaced
    await this.refreshTokenRepository.markAsReplaced(refreshTokenJti, newRefreshTokenJti);

    // Store the new refresh token
    const newTokenHash = TokenCryptoUtil.hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + this.refreshTokenExpirySeconds * 1000);

    await this.refreshTokenRepository.save({
      id: newRefreshTokenJti,
      userId,
      tokenHash: newTokenHash,
      expiresAt,
    });

    return {
      kind: 'success',
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      userId,
    };
  }

  /**
   * Revoke all active sessions for a user
   * Used when reuse is detected or when the user needs to be logged out globally
   */
  async revokeAllSessions(userId: string): Promise<void> {
    await this.refreshTokenRepository.revokeAllForUser(userId);
  }

  /**
   * Revoke a specific refresh token (logout)
   */
  async revokeRefreshToken(refreshToken: string): Promise<void> {
    let payload;
    try {
      payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.jwtRefreshSecret,
      });
    } catch {
      // If token is invalid/expired, it's already unusable, so we can return success
      return;
    }

    const refreshTokenJti = payload.jti;
    await this.refreshTokenRepository.revoke(refreshTokenJti);
  }

  /**
   * Verify an access token and extract the user ID
   */
  async verifyAccessToken(accessToken: string): Promise<string> {
    try {
      const payload = this.jwtService.verify(accessToken, {
        secret: this.configService.jwtAccessSecret,
      });
      return payload.sub;
    } catch {
      throw new InvalidTokenError();
    }
  }
}
