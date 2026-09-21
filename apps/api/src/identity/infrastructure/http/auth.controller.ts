import { Controller, Post, Body, BadRequestException, InternalServerErrorException, HttpCode, Res, Req } from '@nestjs/common';
import type { Response, Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import { Public } from './decorators/public.decorator.js';
import {
  RegisterUser,
  LoginUser,
  RefreshSession,
  LogoutUser,
} from '../../application/index.js';
import { MongooseUserRepository } from '../../infrastructure/persistence/mongoose-user.repository.js';
import { ConfigService } from '../../../config/config.service.js';
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
} from './dtos/index.js';

@Controller('auth')
export class AuthController {
  private readonly refreshTokenMaxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

  constructor(
    private registerUserUseCase: RegisterUser,
    private loginUserUseCase: LoginUser,
    private refreshSessionUseCase: RefreshSession,
    private logoutUserUseCase: LogoutUser,
    private userRepository: MongooseUserRepository,
    private configService: ConfigService,
  ) {}

  private setRefreshTokenCookie(res: Response, refreshToken: string): void {
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.configService.isProduction,
      path: '/api/v1/auth',
      maxAge: this.refreshTokenMaxAge,
    });
  }

  private clearRefreshTokenCookie(res: Response): void {
    res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  }

  @Post('register')
  @Public()
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    accessToken: string;
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
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
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
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{
    accessToken: string;
    user: {
      id: string;
      email: string;
      displayName: string;
    };
  }> {
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

    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
      user: {
        id: user.id,
        email: user.email.value,
        displayName: user.displayName,
      },
    };
  }

  @Post('refresh')
  @Public()
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      throw new BadRequestException('Invalid or expired refresh token');
    }

    const result = await this.refreshSessionUseCase.execute({
      refreshToken,
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
    this.setRefreshTokenCookie(res, tokens.refreshToken);

    return {
      accessToken: tokens.accessToken,
    };
  }

  @Post('logout')
  @Public()
  @HttpCode(201)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      // Still return success for idempotent logout
      this.clearRefreshTokenCookie(res);
      return { message: 'Logged out successfully' };
    }

    const result = await this.logoutUserUseCase.execute({
      refreshToken,
    });

    if (!result.isOk()) {
      throw new BadRequestException('Logout failed');
    }

    this.clearRefreshTokenCookie(res);
    return { message: 'Logged out successfully' };
  }
}
