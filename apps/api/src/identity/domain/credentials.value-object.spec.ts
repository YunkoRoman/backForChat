import { describe, it, expect } from 'vitest';
import { Credentials } from './credentials.value-object.js';

describe('Credentials Value Object', () => {
  describe('constructor', () => {
    it('should create credentials with a hash', () => {
      const hash = '$argon2id$v=19$m=65540,t=2,p=1$hash';
      const credentials = new Credentials(hash);
      expect(credentials.hash).toBe(hash);
    });

    it('should reject empty hash', () => {
      expect(() => new Credentials('')).toThrow();
    });

    it('should reject null hash (type error)', () => {
      // @ts-expect-error - intentionally passing null
      expect(() => new Credentials(null)).toThrow();
    });
  });

  describe('no plaintext accessor', () => {
    it('should NOT have a plaintext password getter', () => {
      const credentials = new Credentials('$argon2id$v=19$m=65540,t=2,p=1$hash');

      // Check that methods like getPlaintext, getPassword, plaintext, password do not exist
      expect(credentials).not.toHaveProperty('getPlaintext');
      expect(credentials).not.toHaveProperty('getPassword');
      expect(credentials).not.toHaveProperty('plaintext');
      expect(credentials).not.toHaveProperty('password');

      // Only .hash and .verify should exist
      expect(credentials).toHaveProperty('hash');
      expect(credentials).toHaveProperty('verify');
    });

    it('should only expose hash getter, not a plaintext field', () => {
      const hash = '$argon2id$v=19$m=65540,t=2,p=1$testcase';
      const credentials = new Credentials(hash);

      // The hash getter should return the opaque hash string
      expect(credentials.hash).toBe(hash);

      // Verify the hash is NOT the plaintext password "myPassword"
      expect(credentials.hash).not.toBe('myPassword');
    });
  });

  describe('verify method', () => {
    it('should accept a hasher interface to verify passwords', async () => {
      const hash = '$argon2id$v=19$m=65540,t=2,p=1$hash';
      const credentials = new Credentials(hash);

      const mockHasher = {
        verify: async (plaintext: string, hashedValue: string) => {
          // Simple mock: check if plaintext matches the hashed value (obviously not secure, just for testing)
          return plaintext === 'correctPassword' && hashedValue === hash;
        },
      };

      const result = await credentials.verify('correctPassword', mockHasher);
      expect(result).toBe(true);
    });

    it('should return false when password does not match', async () => {
      const hash = '$argon2id$v=19$m=65540,t=2,p=1$hash';
      const credentials = new Credentials(hash);

      const mockHasher = {
        verify: async (plaintext: string, hashedValue: string) => {
          return plaintext === 'correctPassword' && hashedValue === hash;
        },
      };

      const result = await credentials.verify('wrongPassword', mockHasher);
      expect(result).toBe(false);
    });

    it('should pass both plaintext and hash to the hasher', async () => {
      const hash = 'myhash123';
      const credentials = new Credentials(hash);

      let capturedPlaintext = '';
      let capturedHash = '';

      const mockHasher = {
        verify: async (plaintext: string, hashedValue: string) => {
          capturedPlaintext = plaintext;
          capturedHash = hashedValue;
          return true;
        },
      };

      await credentials.verify('testPassword', mockHasher);

      expect(capturedPlaintext).toBe('testPassword');
      expect(capturedHash).toBe(hash);
    });
  });
});
