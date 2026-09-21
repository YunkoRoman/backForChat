export interface PasswordHasher {
  /**
   * Hash a plaintext password.
   * @param plaintext The plaintext password to hash
   * @returns The hashed password (opaque to the caller, suitable for storage)
   */
  hash(plaintext: string): Promise<string>;

  /**
   * Verify a plaintext password against a hash.
   * @param plaintext The plaintext password to verify
   * @param hash The hash to check against
   * @returns true if the password matches the hash, false otherwise
   */
  verify(plaintext: string, hash: string): Promise<boolean>;
}
