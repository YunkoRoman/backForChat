import { IsEmail, IsString, MinLength, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;

  @IsString({ message: 'Password must be a string' })
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must not exceed 128 characters' })
  password: string;

  @IsString({ message: 'Display name must be a string' })
  @MinLength(1, { message: 'Display name must not be empty' })
  @MaxLength(255, { message: 'Display name must not exceed 255 characters' })
  displayName: string;
}
