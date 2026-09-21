import { Controller, Post, Body, BadRequestException, InternalServerErrorException, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from './decorators/public.decorator.js';
import {
  RegisterUser,
  LoginUser,
  RefreshSession,
  LogoutUser,
} from '../../application/index.js';
import { MongooseUserRepository } from '../../infrastructure/persistence/mongoose-user.repository.js';
import {
  DuplicateEmailError,
  WeakPasswordError,
  InvalidCredentialsError,
  TokenReuseDetectedError,
  InvalidTokenError,
} from '../../domain/errors.js';
import {
  RegisterDto,
  LoginDto,
  RefreshDto,
  AuthResponseDto,
} from './dtos/index.js';

@Controller('auth')
export class AuthController {
  constructor(
    private registerUserUseCase: RegisterUser,
    private loginUserUseCase: LoginUser,
    private refreshSessionUseCase: RefreshSession,
    private logoutUserUseCase: LogoutUser,
    private userRepository: MongooseUserRepository,
  ) {}

  @Post('register')
  @Public()
  async register(@Body() dto: RegisterDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      displayName: string;
    };
  }> {
    const result = await this.registerUserUseCase.execute({
      email: dto.email,
      password: dto.password,
      displayName: dto.displayName,
    });

    if (!result.isOk()) {
      const error = result.error;
      if (error instanceof DuplicateEmailError) {
        throw new BadRequestException('Email already registered');
      }
      if (error instanceof WeakPasswordError) {
        throw new BadRequestException(error.message);
      }
      throw new BadRequestException('Registration failed');
    }

    // Issue tokens for the newly registered user
    const registerResponse = result.value;
    const tokenResult = await this.loginUserUseCase.execute({
      email: registerResponse.email,
      password: dto.password,
    });

    if (!tokenResult.isOk()) {
      throw new BadRequestException('Failed to issue tokens after registration');
    }

    const tokens = tokenResult.value;
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: registerResponse.userId,
        email: registerResponse.email,
        displayName: registerResponse.displayName,
      },
    };
  }

  @Post('login')
  @Public()
  @Throttle({ default: { limit: 5, ttl: 60 * 1000 } })
  async login(@Body() dto: LoginDto): Promise<AuthResponseDto> {
    const result = await this.loginUserUseCase.execute({
      email: dto.email,
      password: dto.password,
    });

    if (!result.isOk()) {
      const error = result.error;
      if (error instanceof InvalidCredentialsError) {
        throw new BadRequestException('Invalid email or password');
      }
      throw new BadRequestException('Login failed');
    }

    const tokens = result.value;

    // Fetch the user to return in the response
    const user = await this.userRepository.findByEmail(dto.email);
    if (!user) {
      throw new InternalServerErrorException('User not found after successful login');
    }

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        email: user.email.value,
        displayName: user.displayName,
      },
    };
  }

  @Post('refresh')
  @Public()
  async refresh(@Body() dto: RefreshDto): Promise<AuthResponseDto> {
    const result = await this.refreshSessionUseCase.execute({
      refreshToken: dto.refreshToken,
    });

    if (!result.isOk()) {
      const error = result.error;
      if (error instanceof TokenReuseDetectedError) {
        throw new BadRequestException(
          'Refresh token reuse detected. All sessions revoked. Please login again.',
        );
      }
      if (error instanceof InvalidTokenError) {
        throw new BadRequestException('Invalid or expired refresh token');
      }
      throw new BadRequestException('Token refresh failed');
    }

    const tokens = result.value;
    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    };
  }

  @Post('logout')
  @Public()
  @HttpCode(201)
  async logout(@Body() dto: RefreshDto): Promise<{ message: string }> {
    const result = await this.logoutUserUseCase.execute({
      refreshToken: dto.refreshToken,
    });

    if (!result.isOk()) {
      throw new BadRequestException('Logout failed');
    }

    return { message: 'Logged out successfully' };
  }
}
