import { describe, it, expect } from 'vitest';
import { ok, err, Ok, Err } from './result';

describe('Result', () => {
  describe('ok constructor', () => {
    it('should create an Ok result with a value', () => {
      const result = ok(42);

      expect(result).toBeInstanceOf(Ok);
      expect(result.isOk()).toBe(true);
      expect(result.isErr()).toBe(false);
      expect(result.value).toBe(42);
    });

    it('should work with complex objects', () => {
      const obj = { name: 'test', count: 10 };
      const result = ok(obj);

      expect(result.isOk()).toBe(true);
      expect(result.value).toBe(obj);
    });

    it('should work with arrays', () => {
      const arr = [1, 2, 3];
      const result = ok(arr);

      expect(result.isOk()).toBe(true);
      expect(result.value).toBe(arr);
    });
  });

  describe('err constructor', () => {
    it('should create an Err result with an error', () => {
      const error = new Error('Test error');
      const result = err(error);

      expect(result).toBeInstanceOf(Err);
      expect(result.isOk()).toBe(false);
      expect(result.isErr()).toBe(true);
      expect(result.error).toBe(error);
    });

    it('should work with string errors', () => {
      const result = err('Something went wrong');

      expect(result.isErr()).toBe(true);
      expect(result.error).toBe('Something went wrong');
    });

    it('should work with custom error objects', () => {
      const customError = { code: 'INVALID_INPUT', message: 'Invalid' };
      const result = err(customError);

      expect(result.isErr()).toBe(true);
      expect(result.error).toEqual(customError);
    });
  });

  describe('Ok.ok static method', () => {
    it('should create an Ok result', () => {
      const result = Ok.ok(100);

      expect(result.isOk()).toBe(true);
      expect(result.value).toBe(100);
    });
  });

  describe('Err.err static method', () => {
    it('should create an Err result', () => {
      const error = new Error('Test');
      const result = Err.err(error);

      expect(result.isErr()).toBe(true);
      expect(result.error).toBe(error);
    });
  });

  describe('type narrowing', () => {
    it('should narrow to Ok type after isOk check', () => {
      const result = ok(42);

      if (result.isOk()) {
        // TypeScript should narrow to Ok<number>
        const value: number = result.value;
        expect(value).toBe(42);
      }
    });

    it('should narrow to Err type after isErr check', () => {
      const error = new Error('Test');
      const result = err(error);

      if (result.isErr()) {
        // TypeScript should narrow to Err<Error>
        const e: Error = result.error;
        expect(e.message).toBe('Test');
      }
    });
  });

  describe('discriminated union', () => {
    it('should have kind property for Ok', () => {
      const result = ok('test');

      if (result.kind === 'ok') {
        expect(result.value).toBe('test');
      }
    });

    it('should have kind property for Err', () => {
      const result = err('error');

      if (result.kind === 'err') {
        expect(result.error).toBe('error');
      }
    });
  });
});
