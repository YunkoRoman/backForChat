/**
 * Credentials value object.
 *
 * IMPORTANT: This class ONLY accepts a password hash, never a plaintext password.
 * There is no way to read out or reconstruct a plaintext password from this object.
 * Password hashing and verification is delegated to an injected hasher.
 */
export class Credentials {
  private readonly _hash: string;

  constructor(hash: string) {
    if (!hash || hash.length === 0) {
      throw new Error('Credentials hash cannot be empty');
    }
    this._hash = hash;
  }

  /**
   * Verify a plaintext password against this credentials' hash.
   * Returns true if the password matches, false otherwise.
   *
   * @param plaintext The plaintext password to verify
   * @param hasher An object with a verify method; not expected to be called directly in domain tests
   */
  async verify(
    plaintext: string,
    hasher: { verify(plaintext: string, hash: string): Promise<boolean> },
  ): Promise<boolean> {
    return hasher.verify(plaintext, this._hash);
  }

  /**
   * Get the hash value (intended for infrastructure layer only, e.g., to store/retrieve from DB).
   * This is NOT a plaintext password; it's an opaque hash string.
   */
  get hash(): string {
    return this._hash;
  }
}
