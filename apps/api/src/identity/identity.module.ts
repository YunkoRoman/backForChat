import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';

// Domain & Application
import {
  RegisterUser,
  LoginUser,
  RefreshSession,
  LogoutUser,
  ListUsers,
} from './application/index.js';

// Infrastructure - Persistence
import { UserSchema as UserSchemaFactory } from './infrastructure/persistence/user.schema.js';
import { RefreshTokenSchema as RefreshTokenSchemaFactory } from './infrastructure/persistence/refresh-token.schema.js';
import { MongooseUserRepository } from './infrastructure/persistence/mongoose-user.repository.js';
import { RefreshTokenRepository } from './infrastructure/persistence/refresh-token.repository.js';

// Infrastructure - Adapters
import { Argon2PasswordHasher } from './infrastructure/adapters/argon2-password.hasher.js';
import { JwtTokenService } from './infrastructure/adapters/jwt-token.service.js';
import { RabbitMqEventPublisher } from '../shared-kernel/infrastructure/rabbitmq-event-publisher.js';

// Infrastructure - HTTP
import { AuthController } from './infrastructure/http/auth.controller.js';
import { UsersController } from './infrastructure/http/users.controller.js';
import { JwtAuthGuard } from './infrastructure/http/guards/jwt-auth.guard.js';

// Config
import { ConfigModule } from '../config/config.module.js';
import { SharedKernelModule } from '../shared-kernel/shared-kernel.module.js';

@Module({
  imports: [
    // Import Mongoose schemas
    MongooseModule.forFeature([
      { name: 'User', schema: UserSchemaFactory },
      { name: 'RefreshToken', schema: RefreshTokenSchemaFactory },
    ]),
    // Import JWT module
    JwtModule.register({}),
    // Import ConfigModule for accessing configuration
    ConfigModule,
    // Import SharedKernelModule for EventPublisher
    SharedKernelModule,
  ],
  controllers: [AuthController, UsersController],
  providers: [
    // Repositories
    MongooseUserRepository,
    RefreshTokenRepository,

    // Adapters
    Argon2PasswordHasher,
    JwtTokenService,

    // Use Cases
    {
      provide: RegisterUser,
      useFactory: (userRepo: MongooseUserRepository, hasher: Argon2PasswordHasher, eventPublisher: RabbitMqEventPublisher) =>
        new RegisterUser(userRepo, hasher, eventPublisher),
      inject: [MongooseUserRepository, Argon2PasswordHasher, RabbitMqEventPublisher],
    },
    {
      provide: LoginUser,
      useFactory: (
        userRepo: MongooseUserRepository,
        hasher: Argon2PasswordHasher,
        tokenService: JwtTokenService,
      ) => new LoginUser(userRepo, hasher, tokenService),
      inject: [MongooseUserRepository, Argon2PasswordHasher, JwtTokenService],
    },
    {
      provide: RefreshSession,
      useFactory: (tokenService: JwtTokenService) => new RefreshSession(tokenService),
      inject: [JwtTokenService],
    },
    {
      provide: LogoutUser,
      useFactory: (tokenService: JwtTokenService) => new LogoutUser(tokenService),
      inject: [JwtTokenService],
    },
    {
      provide: ListUsers,
      useFactory: (userRepo: MongooseUserRepository) => new ListUsers(userRepo),
      inject: [MongooseUserRepository],
    },

    // Guards
    JwtAuthGuard,
  ],
  exports: [
    // Export repositories and adapters for other modules that might need them
    MongooseUserRepository,
    RefreshTokenRepository,
    Argon2PasswordHasher,
    JwtTokenService,
    // Export use cases
    RegisterUser,
    LoginUser,
    RefreshSession,
    LogoutUser,
    ListUsers,
    // Export ports/interfaces
  ],
})
export class IdentityModule {}
