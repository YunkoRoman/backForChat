import { Injectable } from '@nestjs/common';
import { Env, envSchema } from './env.schema.js';

@Injectable()
export class ConfigService {
  private readonly env: Env;

  constructor() {
    const parsed = envSchema.safeParse(process.env);

    if (!parsed.success) {
      const errors = parsed.error.issues
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((issue: any) => `${(issue.path as (string | number)[]).join('.')}: ${issue.message}`)
        .join(', ');
      throw new Error(`Environment validation failed: ${errors}`);
    }

    this.env = parsed.data;
  }

  get mongoUri(): string {
    return this.env.MONGO_URI;
  }

  get jwtAccessSecret(): string {
    return this.env.JWT_ACCESS_SECRET;
  }

  get jwtRefreshSecret(): string {
    return this.env.JWT_REFRESH_SECRET;
  }

  get rabbitmqUrl(): string {
    return this.env.RABBITMQ_URL;
  }

  get frontendOrigin(): string {
    return this.env.FRONTEND_ORIGIN;
  }

  get port(): number {
    return this.env.PORT;
  }

  get nodeEnv(): string {
    return this.env.NODE_ENV;
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get isDevelopment(): boolean {
    return this.env.NODE_ENV === 'development';
  }
}
