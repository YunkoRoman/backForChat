import { describe, it, expect, beforeEach } from 'vitest';
import { RegisterUser } from './register-user.use-case.js';
import { UserRepository } from './ports/user-repository.interface.js';
import { PasswordHasher } from './ports/password-hasher.interface.js';
import { EventPublisher } from '../../shared-kernel/index.js';
import { User } from '../domain/user.aggregate.js';
import { DuplicateEmailError, WeakPasswordError } from '../domain/errors.js';

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
}

/**
 * In-memory fake implementation of PasswordHasher for testing.
 */
class FakePasswordHasher implements PasswordHasher {
  private hashes = new Map<string, string>();

  async hash(plaintext: string): Promise<string> {
    // Simple fake: prefix with "hashed:" to simulate a hash
    const fakeHash = `hashed:${plaintext}`;
    this.hashes.set(plaintext, fakeHash);
    return fakeHash;
  }

  async verify(plaintext: string, hash: string): Promise<boolean> {
    // Simple fake: check if hash matches "hashed:" + plaintext
    return hash === `hashed:${plaintext}`;
  }
}

/**
 * In-memory fake implementation of EventPublisher for testing.
 */
class FakeEventPublisher implements EventPublisher {
  private publishedEvents: Array<{ routingKey: string; payload: unknown }> = [];

  async publish(routingKey: string, payload: unknown): Promise<void> {
    this.publishedEvents.push({ routingKey, payload });
  }

  getPublishedEvents(): Array<{ routingKey: string; payload: unknown }> {
    return this.publishedEvents;
  }

  clearPublishedEvents(): void {
    this.publishedEvents = [];
  }
}

describe('RegisterUser Use Case', () => {
  let registerUser: RegisterUser;
  let userRepository: FakeUserRepository;
  let passwordHasher: FakePasswordHasher;
  let eventPublisher: FakeEventPublisher;

  beforeEach(() => {
    userRepository = new FakeUserRepository();
    passwordHasher = new FakePasswordHasher();
    eventPublisher = new FakeEventPublisher();
    registerUser = new RegisterUser(userRepository, passwordHasher, eventPublisher);
  });

  describe('successful registration', () => {
    it('should register a user with valid email, password, and displayName', async () => {
      const result = await registerUser.execute({
        email: 'newuser@example.com',
        password: 'ValidPassword123',
        displayName: 'New User',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.email).toBe('newuser@example.com');
        expect(result.value.displayName).toBe('New User');
        expect(result.value.userId).toBeDefined();

        // Verify user was persisted
        const persistedUser = await userRepository.findByEmail('newuser@example.com');
        expect(persistedUser).toBeDefined();
        expect(persistedUser?.displayName).toBe('New User');
      }
    });

    it('should normalize email to lowercase when registering', async () => {
      const result = await registerUser.execute({
        email: 'NewUser@Example.COM',
        password: 'ValidPassword123',
        displayName: 'User',
      });

      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.email).toBe('newuser@example.com');
      }

      // Should not allow registering the same email with different case
      const result2 = await registerUser.execute({
        email: 'newuser@example.com',
        password: 'AnotherPassword123',
        displayName: 'Another User',
      });

      expect(result2.isErr()).toBe(true);
      if (result2.isErr()) {
        expect(result2.error).toBeInstanceOf(DuplicateEmailError);
      }
    });

    it('should hash the password before storing', async () => {
      const plainPassword = 'MySecurePassword';
      const result = await registerUser.execute({
        email: 'test@example.com',
        password: plainPassword,
        displayName: 'Test User',
      });

      expect(result.isOk()).toBe(true);

      // Verify the user was stored with a hashed password, not plaintext
      const persistedUser = await userRepository.findByEmail('test@example.com');
      expect(persistedUser).toBeDefined();
      // The credentials hash should not be the plaintext password
      expect(persistedUser?.credentials.hash).not.toBe(plainPassword);
      // It should be the fake hashed version
      expect(persistedUser?.credentials.hash).toBe(`hashed:${plainPassword}`);
    });
  });

  describe('duplicate email rejection', () => {
    it('should reject registration when email is already in use', async () => {
      // Register the first user
      const result1 = await registerUser.execute({
        email: 'duplicate@example.com',
        password: 'Password123',
        displayName: 'First User',
      });
      expect(result1.isOk()).toBe(true);

      // Try to register with the same email
      const result2 = await registerUser.execute({
        email: 'duplicate@example.com',
        password: 'DifferentPassword123',
        displayName: 'Second User',
      });

      expect(result2.isErr()).toBe(true);
      if (result2.isErr()) {
        expect(result2.error).toBeInstanceOf(DuplicateEmailError);
        expect(result2.error.message).toContain('duplicate@example.com');
      }
    });

    it('should treat email comparison as case-insensitive', async () => {
      // Register with one case
      const result1 = await registerUser.execute({
        email: 'CaseSensitive@Example.COM',
        password: 'Password123',
        displayName: 'User One',
      });
      expect(result1.isOk()).toBe(true);

      // Try to register with different case
      const result2 = await registerUser.execute({
        email: 'casesensitive@example.com',
        password: 'AnotherPassword123',
        displayName: 'User Two',
      });

      expect(result2.isErr()).toBe(true);
      if (result2.isErr()) {
        expect(result2.error).toBeInstanceOf(DuplicateEmailError);
      }
    });
  });

  describe('weak password rejection', () => {
    it('should reject password shorter than 8 characters', async () => {
      const result = await registerUser.execute({
        email: 'weak@example.com',
        password: 'Short1',
        displayName: 'User',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(WeakPasswordError);
        expect(result.error.message).toContain('at least 8 characters');
      }
    });

    it('should reject empty password', async () => {
      const result = await registerUser.execute({
        email: 'empty@example.com',
        password: '',
        displayName: 'User',
      });

      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(WeakPasswordError);
      }
    });

    it('should accept password exactly 8 characters', async () => {
      const result = await registerUser.execute({
        email: 'minimum@example.com',
        password: 'Minimum8',
        displayName: 'User',
      });

      expect(result.isOk()).toBe(true);
    });

    it('should accept long passwords', async () => {
      const result = await registerUser.execute({
        email: 'long@example.com',
        password: 'VeryLongPasswordWithLotsOfCharacters123456789',
        displayName: 'User',
      });

      expect(result.isOk()).toBe(true);
    });
  });

  describe('invalid email rejection', () => {
    it('should reject invalid email format at domain layer', async () => {
      // InvalidEmailError is thrown by Email constructor, not caught as a Result
      await expect(
        registerUser.execute({
          email: 'notanemail',
          password: 'ValidPassword123',
          displayName: 'User',
        }),
      ).rejects.toThrow();
    });
  });

  describe('event publishing', () => {
    it('should publish user.registered event after successful persistence', async () => {
      const result = await registerUser.execute({
        email: 'newuser@example.com',
        password: 'ValidPassword123',
        displayName: 'New User',
      });

      expect(result.isOk()).toBe(true);

      // Verify the event was published
      const publishedEvents = eventPublisher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(1);
      expect(publishedEvents[0].routingKey).toBe('user.registered');
      expect(publishedEvents[0].payload).toEqual(
        expect.objectContaining({
          email: 'newuser@example.com',
          displayName: 'New User',
          userId: expect.any(String),
          createdAt: expect.any(String),
        }),
      );
    });

    it('should not publish event if persistence fails', async () => {
      // Create a broken repository that throws on save
      class BrokenRepository extends FakeUserRepository {
        async save(): Promise<void> {
          throw new Error('Persistence failed');
        }
      }

      const brokenRepo = new BrokenRepository();
      const brokenRegisterUser = new RegisterUser(
        brokenRepo,
        passwordHasher,
        eventPublisher,
      );

      await expect(
        brokenRegisterUser.execute({
          email: 'test@example.com',
          password: 'ValidPassword123',
          displayName: 'Test User',
        }),
      ).rejects.toThrow('Persistence failed');

      // Verify no event was published
      const publishedEvents = eventPublisher.getPublishedEvents();
      expect(publishedEvents).toHaveLength(0);
    });
  });
});
