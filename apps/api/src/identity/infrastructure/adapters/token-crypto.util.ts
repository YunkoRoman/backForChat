import { createHash } from 'crypto';

/**
 * Utility for hashing tokens for secure storage
 * Uses SHA-256 to create one-way hashes of tokens
 */
export class TokenCryptoUtil {
  /**
   * Hash a token for storage
   * The hash is one-way; the original token cannot be recovered from it
   * This ensures that even if the database is compromised, tokens cannot be used directly
   *
   * @param token The raw token string to hash
   * @returns The hex-encoded SHA-256 hash
   */
  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * Verify a token against its hash
   * @param token The raw token to verify
   * @param hash The stored hash to check against
   * @returns true if the token's hash matches the stored hash
   */
  static verifyTokenHash(token: string, hash: string): boolean {
    const computedHash = TokenCryptoUtil.hashToken(token);
    return computedHash === hash;
  }
}
