import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_PIPE, APP_FILTER } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from './config/config.module.js';
import { ConfigService } from './config/config.service.js';
import { IdentityModule } from './identity/identity.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { PresenceModule } from './presence/presence.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { JwtAuthGuard } from './identity/infrastructure/http/guards/jwt-auth.guard.js';
import { SharedKernelModule } from './shared-kernel/shared-kernel.module.js';
import { GlobalExceptionFilter } from './shared-kernel/infrastructure/filters/global-exception.filter.js';
import { CorrelationIdMiddleware } from './shared-kernel/infrastructure/middleware/correlation-id.middleware.js';

@Module({
  imports: [
    ConfigModule,
    // MongoDB connection
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        uri: configService.mongoUri,
      }),
      inject: [ConfigService],
    }),
    // Throttling
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60 * 1000, // 60 seconds
        limit: 100, // 100 requests per minute by default
      },
    ]),
    // Shared Kernel (event publisher, etc)
    SharedKernelModule,
    // Identity module (auth)
    IdentityModule,
    // Messaging module
    MessagingModule,
    // Presence module
    PresenceModule,
    // Notifications module (event consumers)
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Global exception filter for sanitized error responses
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
    // Global auth guard
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    // Global validation pipe with whitelist for NoSQL injection prevention
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply correlation ID middleware to all routes
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
