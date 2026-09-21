import { IsOptional, IsString, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GetMessagesQueryDto {
  /**
   * Optional message ID to start pagination before (retrieve messages older than this)
   */
  @IsOptional()
  @IsString({ message: 'before must be a string' })
  before?: string;

  /**
   * Number of messages to retrieve (default: 50, max: 100)
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1, { message: 'limit must be at least 1' })
  limit?: number = 50;
}
