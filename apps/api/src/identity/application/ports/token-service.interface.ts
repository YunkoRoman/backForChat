/**
 * Token Service Interface
 *
 * Handles issuing, rotating, and revoking JWT tokens.
 * Implements short-lived access tokens and rotating refresh tokens with reuse detection.
 */
export interface TokenService {
  /**
   * Issue a new access token and refresh token pair for a user.
   * @param userId The user ID to issue tokens for
   * @returns An object containing the access token and refresh token
   */
  issueTokens(userId: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }>;

  /**
   * Rotate a refresh token, issuing a new access token and refresh token pair.
   * Invalidates the old refresh token.
   *
   * @param refreshToken The refresh token to rotate
   * @returns Either success (new tokens) or reuse detection
   * @throws InvalidTokenError if the token is invalid or expired
   */
  rotateRefreshToken(
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
  >;

  /**
   * Revoke all active sessions for a user.
   * @param userId The user ID whose sessions should be revoked
   */
  revokeAllSessions(userId: string): Promise<void>;

  /**
   * Revoke a specific refresh token (logout).
   * @param refreshToken The refresh token to revoke
   */
  revokeRefreshToken(refreshToken: string): Promise<void>;

  /**
   * Verify an access token and extract its payload.
   * @param accessToken The access token to verify
   * @returns The user ID extracted from the token
   * @throws if the token is invalid or expired
   */
  verifyAccessToken(accessToken: string): Promise<string>;
}
