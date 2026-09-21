import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { pinoLogger } from '../logging/pino-logger.js';

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Generate or read correlation ID
    const correlationId =
      (req.headers['x-request-id'] as string) || randomUUID();
    req.correlationId = correlationId;

    // `req.originalUrl` (captured once, up front) rather than `req.path`:
    // Nest mounts the global-prefix router as a sub-router, which rewrites
    // `req.url` (and therefore `req.path`) while a request is inside it -
    // reading `req.path` again later, from within the deferred res.send
    // override below, returned a different value than reading it here
    // (logs showed "/" for every "Request received" line, but the correct
    // path for "Response sent"). `req.originalUrl` isn't affected by that
    // rewriting, and capturing it once keeps both log lines consistent.
    const path = req.originalUrl;

    // Log request start with correlation ID
    pinoLogger.info(
      { correlationId, method: req.method, path },
      'Request received',
    );

    // Hook into response to set header and log completion
    const originalSend = res.send;
    res.send = function (data: unknown) {
      // Set correlation ID header before sending response
      res.setHeader('x-request-id', correlationId);

      // Log response completion with correlation ID
      pinoLogger.info(
        {
          correlationId,
          method: req.method,
          path,
          statusCode: res.statusCode,
        },
        'Response sent',
      );
      return originalSend.call(this, data);
    };

    next();
  }
}
