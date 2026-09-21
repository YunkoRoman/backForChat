import { IsString } from 'class-validator';

export class AddMemberDto {
  @IsString({ message: 'userId must be a string' })
  userId: string;
}
