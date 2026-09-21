import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter.js';

function makeHost(overrides?: { path?: string }) {
  const jsonMock = vi.fn();
  const statusMock = vi.fn(() => ({ json: jsonMock }));
  const request = { method: 'GET', path: overrides?.path ?? '/api/v1/test' };
  const response = { status: statusMock };

  const host = {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  return { host, statusMock, jsonMock };
}

describe('GlobalExceptionFilter', () => {
  const filter = new GlobalExceptionFilter();
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('in production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
    });

    it('replaces an unexpected (non-HttpException) error with a generic message', () => {
      const { host, statusMock, jsonMock } = makeHost();
      filter.catch(new Error('database connection string leaked here'), host);

      expect(statusMock).toHaveBeenCalledWith(500);
      const body = jsonMock.mock.calls[0][0];
      expect(body.message).toBe('An error occurred processing your request');
      expect(JSON.stringify(body)).not.toContain('database connection string');
      expect(body).not.toHaveProperty('stack');
      expect(body.details).toBeUndefined();
    });

    it('keeps a deliberate 4xx HttpException message intact', () => {
      const { host, statusMock, jsonMock } = makeHost();
      filter.catch(new BadRequestException('Invalid email or password'), host);

      expect(statusMock).toHaveBeenCalledWith(400);
      const body = jsonMock.mock.calls[0][0];
      expect(body.message).toBe('Invalid email or password');
    });
  });

  describe('outside production', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    it('keeps the real message for an unexpected error too (dev-friendly)', () => {
      const { host, jsonMock } = makeHost();
      filter.catch(new Error('boom'), host);

      const body = jsonMock.mock.calls[0][0];
      expect(body.message).toBe('boom');
    });

    it('never puts a stack trace in the response body', () => {
      const { host, jsonMock } = makeHost();
      filter.catch(new Error('boom'), host);

      const body = jsonMock.mock.calls[0][0];
      expect(body).not.toHaveProperty('stack');
    });
  });
});
