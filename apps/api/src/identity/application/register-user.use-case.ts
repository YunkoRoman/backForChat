import { Result, ok, err, EventPublisher } from '../../shared-kernel/index.js';
import {
  DuplicateEmailError,
  WeakPasswordError,
} from '../domain/errors.js';
import { Email } from '../domain/email.value-object.js';
import { Credentials } from '../domain/credentials.value-object.js';
import { User } from '../domain/user.aggregate.js';
import { UserRepository } from './ports/user-repository.interface.js';
import { PasswordHasher } from './ports/password-hasher.interface.js';
import { randomUUID } from 'node:crypto';

export interface RegisterUserRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface RegisterUserResponse {
  userId: string;
  email: string;
  displayName: string;
}

export class RegisterUser {
  // Minimum password length (8 characters as per spec)
  private static readonly MIN_PASSWORD_LENGTH = 8;

  constructor(
    private userRepository: UserRepository,
    private passwordHasher: PasswordHasher,
    private eventPublisher: EventPublisher,
  ) {}

  async execute(
    request: RegisterUserRequest,
  ): Promise<Result<RegisterUserResponse, DuplicateEmailError | WeakPasswordError>> {
    // Validate email format (Email constructor will throw InvalidEmailError if invalid,
    // which we don't catch here - let it propagate)
    const email = new Email(request.email);

    // Check for duplicate email
    const existingUser = await this.userRepository.findByEmail(email.value);
    if (existingUser) {
      return err(new DuplicateEmailError(email.value));
    }

    // Validate password strength
    if (request.password.length < RegisterUser.MIN_PASSWORD_LENGTH) {
      return err(
        new WeakPasswordError(
          `Password must be at least ${RegisterUser.MIN_PASSWORD_LENGTH} characters long`,
        ),
      );
    }

    // Hash the password
    const passwordHash = await this.passwordHasher.hash(request.password);

    // Create the User aggregate
    const userId = randomUUID();
    const credentials = new Credentials(passwordHash);
    const user = User.create(userId, email, request.displayName, credentials);

    // Persist the user
    await this.userRepository.save(user);

    // Publish the user.registered event (after persistence succeeds)
    await this.eventPublisher.publish('user.registered', {
      userId: user.id,
      email: user.email.value,
      displayName: user.displayName,
      createdAt: new Date().toISOString(),
    });

    return ok({
      userId: user.id,
      email: user.email.value,
      displayName: user.displayName,
    });
  }
}
