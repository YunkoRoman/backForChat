import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { pinoLogger } from '../logging/pino-logger.js';

interface ErrorResponse {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string | string[];
  error?: string;
  details?: unknown;
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const isProduction = process.env.NODE_ENV === 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal Server Error';
    let error: string | undefined;
    let details: unknown;

    // Handle HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'object') {
        const msgValue = (exceptionResponse as Record<string, unknown>).message;
        // Preserve message arrays (e.g., from validation errors) and strings
        if (typeof msgValue === 'string' || Array.isArray(msgValue)) {
          message = msgValue;
        } else {
          message = exception.message;
        }
        error = (exceptionResponse as Record<string, unknown>).error as
          | string
          | undefined;
        if (!isProduction) {
          details = exceptionResponse;
        }
      } else {
        message = exceptionResponse.toString();
      }
    } else {
      message = exception.message || 'Internal Server Error';
    }

    // Log full error details server-side with correlation ID
    const correlationId =
      (request as Request & { correlationId?: string }).correlationId || 'unknown';
    pinoLogger.error(
      {
        correlationId,
        method: request.method,
        path: request.path,
        statusCode: status,
        error: exception.message,
        stack: exception.stack,
      },
      'Unhandled exception',
    );

    // Build sanitized response.
    //
    // Only genuinely unexpected errors (5xx - an unhandled exception, a DB
    // error, a bug) get replaced with a generic message in production.
    // Every 4xx in this app is a deliberate HttpException thrown by our own
    // use cases specifically so the client can show it ("Invalid email or
    // password", "Email already registered", "Cannot add members to a 1:1
    // conversation", validation arrays, ...) - collapsing those to a
    // generic string in production would make login/registration/etc.
    // errors unreadable for real users, which is not what "sanitized" was
    // supposed to mean. Stack traces are never in the response body at
    // all (only `stack` passed to the logger below), in any environment.
    const isServerError = status >= HttpStatus.INTERNAL_SERVER_ERROR;
    const responseMessage: string | string[] =
      isProduction && isServerError
        ? 'An error occurred processing your request'
        : message;

    const errorResponse: ErrorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.path,
      message: responseMessage,
    };

    // Include error and details only in non-production
    if (!isProduction) {
      errorResponse.error = error;
      errorResponse.details = details;
    }

    response.status(status).json(errorResponse);
  }
}
