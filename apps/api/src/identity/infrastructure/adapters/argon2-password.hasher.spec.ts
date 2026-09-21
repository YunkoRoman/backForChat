import { describe, it, expect } from 'vitest';
import { Argon2PasswordHasher } from './argon2-password.hasher.js';

describe('Argon2PasswordHasher', () => {
  const hasher = new Argon2PasswordHasher();

  it('hashes a password and verifies it round-trips successfully', async () => {
    const hash = await hasher.hash('CorrectHorseBatteryStaple');
    const matches = await hasher.verify('CorrectHorseBatteryStaple', hash);
    expect(matches).toBe(true);
  });

  it('rejects a wrong password against a valid hash', async () => {
    const hash = await hasher.hash('CorrectHorseBatteryStaple');
    const matches = await hasher.verify('WrongPassword', hash);
    expect(matches).toBe(false);
  });

  it('never stores the plaintext password as the hash', async () => {
    const plaintext = 'CorrectHorseBatteryStaple';
    const hash = await hasher.hash(plaintext);
    expect(hash).not.toBe(plaintext);
    expect(hash.includes(plaintext)).toBe(false);
  });

  it('produces an argon2id-formatted hash', async () => {
    const hash = await hasher.hash('CorrectHorseBatteryStaple');
    expect(hash.startsWith('$argon2id$')).toBe(true);
  });

  it('returns false instead of throwing for a malformed hash', async () => {
    const matches = await hasher.verify('anything', 'not-a-real-hash');
    expect(matches).toBe(false);
  });
});
