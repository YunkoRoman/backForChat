import pino from 'pino';

// Create pino logger with structured logging
export const pinoLogger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
});
