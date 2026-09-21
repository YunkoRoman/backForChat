import { describe, it, expect, beforeEach } from 'vitest';
import { LoginUser } from './login-user.use-case.js';
import { UserRepository } from './ports/user-repository.interface.js';
import { PasswordHasher } from './ports/password-hasher.interface.js';
import { TokenService } from './ports/token-service.interface.js';
import { User } from '../domain/user.aggregate.js';
import { Email } from '../domain/email.value-object.js';
import { Credentials } from '../domain/credentials.value-object.js';
import { InvalidCredentialsError } from '../domain/errors.js';

/**
 * In-memory fake implementation of UserRepository for testing.
 */
class FakeUserRepository implements UserRepository {
  private users = new Map<string, User>();

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = email.trim().toLowerCase();
    for (const user of this.users.values()) {
      if (user.email.value === normalizedEmail) {
        return user;
      }
    }
    return null;
  }

  async save(user: User): Promise<void> {
    this.users.set(user.id, user);
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id);
  }

  addUser(user: User): void {
    this.users.set(user.id, user);
  }
}

/**
 * In-memory fake implementation of PasswordHasher for testing.
 */
class FakePasswordHasher implements PasswordHasher {
  async hash(plaintext: string): Promise<string> {
    return `hashed:${plaintext}`;
  }

  async verify(plaintext: string, hash: string): Promise<boolean> {
    return hash === `hashed:${plaintext}`;
  }
}

/**
 * In-memory fake implementation of TokenService for testing.
 */
class FakeTokenService implements TokenService {
  private tokenCounter = 0;

  async issueTokens(
    userId: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    this.tokenCounter++;
    return {
      accessToken: `access_${userId}_${this.tokenCounter}`,
      refreshToken: `refresh_${userId}_${this.tokenCounter}`,
    };
  }

  async rotateRefreshToken(
    _refreshToken: string,
  ): Promise<
    | { kind: 'success'; accessToken: string; refreshToken: string; userId: string }
    | { kind: 'reuse-detected'; userId: string }
  > {
    throw new Error('Not implemented in this test');
  }

  async revokeAllSessions(_userId: string): Promise<void> {
    throw new Error('Not implemented in this test');
  }

  async revokeRefreshToken(_refreshToken: string): Promise<void> {
    throw new Error('Not implemented in this test');
  }

  async verifyAccessToken(_accessToken: string): Promise<string> {
    throw new Error('Not implemented in this test');
  }
}

describe('LoginUser Use Case', () => {
  let loginUser: LoginUser;
  let userRepository: FakeUserRepository;
  let passwordHasher: FakePasswordHasher;
  let tokenService: FakeTokenService;

  beforeEach(() => {
    userRepository = new FakeUserRepository();
    passwordHasher = new FakePasswordHasher();
    tokenService = new FakeTokenService();
    loginUser = new LoginUser(userRepository, passwordHasher, tokenService);
  });

  describe('successful login', () => {
    it('should issue tokens for valid credentials', async () => {
      // Set up a user
      const email = new Email('user@example.com');
      const credentials = new Credentials(`hashed:correct-password`);
      const user = User.create('user-123', email, 'Test User', credentials);
      userRepository.addUser(user);

      const result = await loginUser.execute({
        email: 'user@example.com',
        password: 'correct-password',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.accessToken).toBeDefined();
        expect(result.value.refreshToken).toBeDefined();
        expect(result.value.accessToken).toContain('access_');
        expect(result.value.refreshToken).toContain('refresh_');
      }
    });

    it('should normalize email input to lowercase', async () => {
      // Set up a user with lowercase email
      const email = new Email('user@example.com');
      const credentials = new Credentials(`hashed:password123`);
      const user = User.create('user-456', email, 'User', credentials);
      userRepository.addUser(user);

      // Try logging in with uppercase email
      const result = await loginUser.execute({
        email: 'USER@EXAMPLE.COM',
        password: 'password123',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.accessToken).toBeDefined();
      }
    });
  });

  describe('invalid credentials rejection', () => {
    it('should reject unknown email with generic error', async () => {
      const result = await loginUser.execute({
        email: 'unknown@example.com',
        password: 'anypassword',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(InvalidCredentialsError);
        expect(result.error.message).toBe('Invalid email or password');
      }
    });

    it('should reject wrong password with same generic error as unknown email', async () => {
      // Set up a user
      const email = new Email('user@example.com');
      const credentials = new Credentials(`hashed:correct-password`);
      const user = User.create('user-789', email, 'User', credentials);
      userRepository.addUser(user);

      const result = await loginUser.execute({
        email: 'user@example.com',
        password: 'wrong-password',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(InvalidCredentialsError);
        expect(result.error.message).toBe('Invalid email or password');
      }
    });

    it('should return same error for wrong password and unknown email (no user enumeration)', async () => {
      // Set up a real user
      const email = new Email('existing@example.com');
      const credentials = new Credentials(`hashed:password`);
      const user = User.create('existing-user', email, 'Existing', credentials);
      userRepository.addUser(user);

      // Get error for unknown email
      const unknownResult = await loginUser.execute({
        email: 'unknown@example.com',
        password: 'password',
      });

      // Get error for wrong password on existing email
      const wrongPasswordResult = await loginUser.execute({
        email: 'existing@example.com',
        password: 'wrong',
      });

      // Both should be errors
      expect(unknownResult.isErr()).toBe(true);
      expect(wrongPasswordResult.isErr()).toBe(true);

      // Both should have the same error type
      if (unknownResult.isErr() && wrongPasswordResult.isErr()) {
        expect(unknownResult.error).toBeInstanceOf(InvalidCredentialsError);
        expect(wrongPasswordResult.error).toBeInstanceOf(InvalidCredentialsError);
        expect(unknownResult.error.message).toBe(
          wrongPasswordResult.error.message,
        );
      }
    });
  });

  describe('password verification', () => {
    it('should use the PasswordHasher to verify the password', async () => {
      // Set up a user with a hashed password
      const email = new Email('verify@example.com');
      const correctHash = `hashed:my-secure-password`;
      const credentials = new Credentials(correctHash);
      const user = User.create('verify-user', email, 'Verify User', credentials);
      userRepository.addUser(user);

      // Login with correct password
      const result = await loginUser.execute({
        email: 'verify@example.com',
        password: 'my-secure-password',
      });

      expect(result.isOk()).toBe(true);

      // Login with incorrect password
      const failResult = await loginUser.execute({
        email: 'verify@example.com',
        password: 'different-password',
      });

      expect(failResult.isErr()).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle email with leading/trailing whitespace in input', async () => {
      // Set up a user
      const email = new Email('trim@example.com');
      const credentials = new Credentials(`hashed:password`);
      const user = User.create('trim-user', email, 'Trim', credentials);
      userRepository.addUser(user);

      // The Email value object trims whitespace, so the input with whitespace
      // should still match after normalization by the repository lookup
      const result = await loginUser.execute({
        email: '  trim@example.com  ',
        password: 'password',
      });

      expect(result.isOk()).toBe(true);
    });
  });
});
