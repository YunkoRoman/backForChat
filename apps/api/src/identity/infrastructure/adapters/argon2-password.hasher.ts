import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';
import { PasswordHasher } from '../../application/ports/password-hasher.interface.js';

/**
 * Argon2id password hasher adapter
 *
 * Uses argon2id for hashing (memory-hard, resistant to GPU cracking).
 * This is the current OWASP-recommended default for password hashing.
 *
 * Configuration:
 * - Algorithm: argon2id (hybrid of data-dependent and data-independent memory accesses)
 * - Memory: 19 MiB (standard recommendation)
 * - Time cost: 2 iterations
 * - Parallelism: 1 thread (sufficient for most use cases)
 */
@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  /**
   * Hash a plaintext password
   * @param plaintext The plaintext password to hash
   * @returns The hashed password in argon2id format
   */
  async hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, {
      type: argon2.argon2id,
      memoryCost: 19 * 1024, // 19 MiB
      timeCost: 2,
      parallelism: 1,
    });
  }

  /**
   * Verify a plaintext password against an argon2id hash
   * @param plaintext The plaintext password to verify
   * @param hash The argon2id hash to check against
   * @returns true if the password matches the hash, false otherwise
   */
  async verify(plaintext: string, hash: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plaintext);
    } catch {
      // If verification fails due to invalid hash format, return false
      return false;
    }
  }
}
