import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';

import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule } from './config/config.module.js';
import { ConfigService } from './config/config.service.js';
import { IdentityModule } from './identity/identity.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { JwtAuthGuard } from './identity/infrastructure/http/guards/jwt-auth.guard.js';

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
    // Identity module (auth)
    IdentityModule,
    // Messaging module
    MessagingModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
export class AppModule {}
