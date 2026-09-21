import { Result, ok, err } from '../../shared-kernel/index.js';
import { InvalidCredentialsError } from '../domain/errors.js';
import { UserRepository } from './ports/user-repository.interface.js';
import { PasswordHasher } from './ports/password-hasher.interface.js';
import { TokenService } from './ports/token-service.interface.js';

export interface LoginUserRequest {
  email: string;
  password: string;
}

export interface LoginUserResponse {
  accessToken: string;
  refreshToken: string;
}

export class LoginUser {
  constructor(
    private userRepository: UserRepository,
    private passwordHasher: PasswordHasher,
    private tokenService: TokenService,
  ) {}

  async execute(
    request: LoginUserRequest,
  ): Promise<Result<LoginUserResponse, InvalidCredentialsError>> {
    // Find user by email (case-insensitive)
    const user = await this.userRepository.findByEmail(request.email);

    // If user not found, return generic error (no user enumeration)
    if (!user) {
      return err(new InvalidCredentialsError());
    }

    // Verify password
    const passwordMatch = await user.credentials.verify(
      request.password,
      this.passwordHasher,
    );

    if (!passwordMatch) {
      // Return the same generic error as "email not found"
      return err(new InvalidCredentialsError());
    }

    // Issue tokens
    const tokens = await this.tokenService.issueTokens(user.id);

    return ok({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  }
}
