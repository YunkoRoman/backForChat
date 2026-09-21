import { InvalidEmailError } from './errors.js';

export class Email {
  private readonly _value: string;

  constructor(value: string) {
    const trimmed = value.trim().toLowerCase();
    if (!this.isValidFormat(trimmed)) {
      throw new InvalidEmailError(value);
    }
    this._value = trimmed;
  }

  get value(): string {
    return this._value;
  }

  equals(other: Email): boolean {
    return this._value === other._value;
  }

  private isValidFormat(email: string): boolean {
    // RFC 5322 simplified regex for practical email validation
    // Matches: anything@anything.anything
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) && email.length > 0 && email.length <= 254;
  }
}
