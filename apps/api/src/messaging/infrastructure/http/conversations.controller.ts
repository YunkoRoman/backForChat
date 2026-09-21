import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  BadRequestException,
  InternalServerErrorException,
  Request,
} from '@nestjs/common';
import { CreateOneToOneConversation, CreateGroupConversation, AddMemberToConversation, ListConversations } from '../../application/index.js';
import {
  GroupMustHaveAtLeastTwoMembersError,
  CannotAddMemberToOneToOneConversationError,
} from '../../domain/errors.js';
import { CreateConversationDto, ConversationTypeEnum } from './dtos/create-conversation.dto.js';
import { AddMemberDto } from './dtos/add-member.dto.js';
import type { AuthenticatedRequest } from '../../../identity/infrastructure/http/types/authenticated-request.js';
@Controller('conversations')
export class ConversationsController {
  constructor(
    private createOneToOneConversationUseCase: CreateOneToOneConversation,
    private createGroupConversationUseCase: CreateGroupConversation,
    private addMemberToConversationUseCase: AddMemberToConversation,
    private listConversationsUseCase: ListConversations,
  ) {}

  @Post()
  async createConversation(
    @Body() dto: CreateConversationDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<{
    conversationId: string;
    type: '1:1' | 'group';
    name: string | null;
    memberIds: string[];
    createdAt: Date;
  }> {
    const requesterId = req.user?.id;
    if (!requesterId) {
      throw new BadRequestException('User not authenticated');
    }

    try {
      if (dto.type === ConversationTypeEnum.ONE_TO_ONE) {
        if (!dto.memberId) {
          throw new BadRequestException('memberId is required for 1:1 conversations');
        }

        if (dto.memberId === requesterId) {
          throw new BadRequestException('Cannot create a 1:1 conversation with yourself');
        }

        const result = await this.createOneToOneConversationUseCase.execute({
          requesterId,
          otherUserId: dto.memberId,
        });

        if (!result.isOk()) {
          throw new BadRequestException('Failed to create 1:1 conversation');
        }

        const response = result.value;
        return {
          conversationId: response.conversationId,
          type: response.type,
          name: null,
          memberIds: response.memberIds,
          createdAt: response.createdAt,
        };
      } else if (dto.type === ConversationTypeEnum.GROUP) {
        if (!dto.name) {
          throw new BadRequestException('name is required for group conversations');
        }

        if (!dto.memberIds || dto.memberIds.length === 0) {
          throw new BadRequestException('At least one member (besides the creator) is required for group conversations');
        }

        // Include the creator in the memberIds for the use case
        const allMemberIds = [requesterId, ...dto.memberIds];

        const result = await this.createGroupConversationUseCase.execute({
          creatorId: requesterId,
          name: dto.name,
          memberIds: allMemberIds,
        });

        if (!result.isOk()) {
          const error = result.error;
          if (error instanceof GroupMustHaveAtLeastTwoMembersError) {
            throw new BadRequestException('Group must have at least 2 members');
          }
          throw new BadRequestException('Failed to create group conversation');
        }

        const response = result.value;
        return {
          conversationId: response.conversationId,
          type: response.type,
          name: response.name,
          memberIds: response.memberIds,
          createdAt: response.createdAt,
        };
      } else {
        throw new BadRequestException('Invalid conversation type');
      }
    } catch (err) {
      if (err instanceof BadRequestException) {
        throw err;
      }
      throw new InternalServerErrorException('Failed to create conversation');
    }
  }

  @Get()
  async listConversations(
    @Request() req: AuthenticatedRequest,
  ): Promise<
    Array<{
      conversationId: string;
      type: '1:1' | 'group';
      name: string | null;
      memberIds: string[];
      createdAt: Date;
    }>
  > {
    const requesterId = req.user?.id;
    if (!requesterId) {
      throw new BadRequestException('User not authenticated');
    }

    try {
      const result = await this.listConversationsUseCase.execute({ requesterId });
      if (!result.isOk()) {
        throw new InternalServerErrorException('Failed to list conversations');
      }
      return result.value.conversations;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to list conversations');
    }
  }

  @Post(':id/members')
  async addMember(
    @Param('id') conversationId: string,
    @Body() dto: AddMemberDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<{
    conversationId: string;
    memberIds: string[];
  }> {
    const requesterId = req.user?.id;
    if (!requesterId) {
      throw new BadRequestException('User not authenticated');
    }

    try {
      const result = await this.addMemberToConversationUseCase.execute({
        requesterId,
        conversationId,
        newMemberId: dto.userId,
      });

      if (!result.isOk()) {
        const error = result.error;
        if (error instanceof CannotAddMemberToOneToOneConversationError) {
          throw new BadRequestException('Cannot add members to a 1:1 conversation');
        }
        throw new BadRequestException('Failed to add member');
      }

      const response = result.value;
      return {
        conversationId: response.conversationId,
        memberIds: response.memberIds,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to add member');
    }
  }
}
