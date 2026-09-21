import { Request } from 'express';

/**
 * Extended Express Request with user information attached by JwtAuthGuard
 */
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
  };
}
