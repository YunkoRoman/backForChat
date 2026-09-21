import { SetMetadata } from '@nestjs/common';

/**
 * Marks a route handler as public (no authentication required)
 * When applied to a handler, the global JwtAuthGuard will skip authentication for that route
 *
 * Usage:
 * @Post('register')
 * @Public()
 * register() { ... }
 */
export const Public = () => SetMetadata('isPublic', true);
