import { describe, it, expect } from 'vitest';
import { DomainError } from './domain-error';

describe('DomainError', () => {
  it('should construct with a message', () => {
    const message = 'Test error message';
    const error = new DomainError(message);

    expect(error.message).toBe(message);
    expect(error.name).toBe('DomainError');
  });

  it('should be an instance of Error', () => {
    const error = new DomainError('Test');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(DomainError);
  });

  it('should have a proper stack trace', () => {
    const error = new DomainError('Test');

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('DomainError');
  });
});
