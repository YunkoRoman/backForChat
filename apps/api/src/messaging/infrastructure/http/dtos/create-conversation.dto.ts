import { IsEnum, IsString, MinLength, MaxLength, IsArray, ValidateIf } from 'class-validator';

export enum ConversationTypeEnum {
  ONE_TO_ONE = '1:1',
  GROUP = 'group',
}

export class CreateConversationDto {
  @IsEnum(ConversationTypeEnum)
  type: ConversationTypeEnum;

  /**
   * For '1:1' conversations: ID of the other user
   * For 'group' conversations: not provided
   */
  @ValidateIf((obj) => obj.type === ConversationTypeEnum.ONE_TO_ONE)
  @IsString({ message: 'For 1:1 conversations, memberId must be a string' })
  memberId?: string;

  /**
   * For 'group' conversations: name of the group
   * For '1:1' conversations: not provided
   */
  @ValidateIf((obj) => obj.type === ConversationTypeEnum.GROUP)
  @IsString({ message: 'Group name must be a string' })
  @MinLength(1, { message: 'Group name must not be empty' })
  @MaxLength(255, { message: 'Group name must not exceed 255 characters' })
  name?: string;

  /**
   * For 'group' conversations: array of user IDs to add (not including creator)
   * For '1:1' conversations: not provided
   */
  @ValidateIf((obj) => obj.type === ConversationTypeEnum.GROUP)
  @IsArray({ message: 'memberIds must be an array' })
  @IsString({ each: true, message: 'Each member ID must be a string' })
  memberIds?: string[];
}
