import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { InvalidTokenError } from '../../../domain/errors.js';
import { JwtTokenService } from '../../adapters/jwt-token.service.js';

/**
 * Global JWT Authentication Guard
 *
 * This guard is registered globally via APP_GUARD and protects all routes by default.
 * Routes marked with @Public() decorator are skipped.
 *
 * For protected routes:
 * - Verifies the access token from the Authorization header (Bearer scheme)
 * - Extracts the user ID from the token
 * - Attaches the user ID to request.user for downstream handlers
 * - Throws UnauthorizedException if the token is invalid or missing
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tokenService: JwtTokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if this route is marked as @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Check if this is a WebSocket context
    const type = context.getType();
    if (type === 'ws') {
      // WebSocket connection - authentication is handled in the gateway's connection handler
      // The userId is stored in socket.data.userId by the gateway's handleConnection method
      const socket = context.switchToWs().getClient();
      if (socket.data?.userId) {
        // Socket is already authenticated
        return true;
      }
      // Socket is not authenticated - reject
      throw new UnauthorizedException('WebSocket client not authenticated');
    }

    // Route is protected - verify the access token
    const request = context.switchToHttp().getRequest<Request & { user?: { id: string } }>();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('No access token provided');
    }

    try {
      const userId = await this.tokenService.verifyAccessToken(token);
      // Attach the user ID to the request object for use in handlers
      request.user = { id: userId };
    } catch (error) {
      if (error instanceof InvalidTokenError) {
        throw new UnauthorizedException(error.message);
      }
      throw error;
    }

    return true;
  }

  /**
   * Extract the Bearer token from the Authorization header
   * @param request The HTTP request
   * @returns The token string, or null if not found or invalid format
   */
  private extractTokenFromHeader(request: Request & { user?: { id: string } }): string | null {
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return null;
    }

    return parts[1];
  }
}
