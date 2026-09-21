import { DomainError } from '../../shared-kernel/domain-error.js';

export class InvalidEmailError extends DomainError {
  constructor(email: string) {
    super(`Invalid email format: ${email}`);
    this.name = 'InvalidEmailError';
    Object.setPrototypeOf(this, InvalidEmailError.prototype);
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor() {
    super('Invalid email or password');
    this.name = 'InvalidCredentialsError';
    Object.setPrototypeOf(this, InvalidCredentialsError.prototype);
  }
}

export class DuplicateEmailError extends DomainError {
  constructor(email: string) {
    super(`Email already registered: ${email}`);
    this.name = 'DuplicateEmailError';
    Object.setPrototypeOf(this, DuplicateEmailError.prototype);
  }
}

export class WeakPasswordError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'WeakPasswordError';
    Object.setPrototypeOf(this, WeakPasswordError.prototype);
  }
}

export class TokenReuseDetectedError extends DomainError {
  constructor() {
    super('Refresh token reuse detected. All sessions revoked.');
    this.name = 'TokenReuseDetectedError';
    Object.setPrototypeOf(this, TokenReuseDetectedError.prototype);
  }
}

export class InvalidTokenError extends DomainError {
  constructor() {
    super('Invalid or expired token');
    this.name = 'InvalidTokenError';
    Object.setPrototypeOf(this, InvalidTokenError.prototype);
  }
}
