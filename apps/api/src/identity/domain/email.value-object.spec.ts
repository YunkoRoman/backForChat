import { describe, it, expect } from 'vitest';
import { Email } from './email.value-object.js';
import { InvalidEmailError } from './errors.js';

describe('Email Value Object', () => {
  describe('constructor', () => {
    it('should create a valid email', () => {
      const email = new Email('test@example.com');
      expect(email.value).toBe('test@example.com');
    });

    it('should normalize email to lowercase', () => {
      const email = new Email('TEST@EXAMPLE.COM');
      expect(email.value).toBe('test@example.com');
    });

    it('should trim whitespace', () => {
      const email = new Email('  test@example.com  ');
      expect(email.value).toBe('test@example.com');
    });

    it('should reject email without @', () => {
      expect(() => new Email('notanemail.com')).toThrow(InvalidEmailError);
    });

    it('should reject email without domain extension', () => {
      expect(() => new Email('test@example')).toThrow(InvalidEmailError);
    });

    it('should reject email with empty string', () => {
      expect(() => new Email('')).toThrow(InvalidEmailError);
    });

    it('should reject email with only whitespace', () => {
      expect(() => new Email('   ')).toThrow(InvalidEmailError);
    });

    it('should reject email with spaces in local part', () => {
      expect(() => new Email('test name@example.com')).toThrow(
        InvalidEmailError,
      );
    });

    it('should reject email with spaces in domain', () => {
      expect(() => new Email('test@exam ple.com')).toThrow(InvalidEmailError);
    });

    it('should accept valid emails with subdomains', () => {
      const email = new Email('user@mail.example.co.uk');
      expect(email.value).toBe('user@mail.example.co.uk');
    });

    it('should accept valid emails with + addressing', () => {
      const email = new Email('user+tag@example.com');
      expect(email.value).toBe('user+tag@example.com');
    });

    it('should accept valid emails with numbers and dots', () => {
      const email = new Email('user.name123@example.com');
      expect(email.value).toBe('user.name123@example.com');
    });

    it('should reject email exceeding RFC 5321 length limit', () => {
      const longEmail = 'a'.repeat(250) + '@example.com';
      expect(() => new Email(longEmail)).toThrow(InvalidEmailError);
    });
  });

  describe('equals', () => {
    it('should return true for equal emails', () => {
      const email1 = new Email('test@example.com');
      const email2 = new Email('test@example.com');
      expect(email1.equals(email2)).toBe(true);
    });

    it('should return true for emails that normalize to the same value', () => {
      const email1 = new Email('Test@Example.Com');
      const email2 = new Email('test@example.com');
      expect(email1.equals(email2)).toBe(true);
    });

    it('should return false for different emails', () => {
      const email1 = new Email('test1@example.com');
      const email2 = new Email('test2@example.com');
      expect(email1.equals(email2)).toBe(false);
    });
  });

  describe('value getter', () => {
    it('should expose the normalized email value', () => {
      const email = new Email('TEST@EXAMPLE.COM');
      expect(email.value).toBe('test@example.com');
    });

    it('should be immutable (readonly)', () => {
      const email = new Email('test@example.com');
      // @ts-expect-error - intentionally trying to mutate readonly
      expect(() => {
        email.value = 'newemail@example.com';
      }).toThrow();
    });
  });
});
