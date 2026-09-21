import {
  Controller,
  Get,
  Param,
  Query,
  BadRequestException,
  InternalServerErrorException,
  Request,
} from '@nestjs/common';
import { GetMessageHistory } from '../../application/index.js';
import { RequesterNotAMemberError } from '../../domain/errors.js';
import { GetMessagesQueryDto } from './dtos/get-messages-query.dto.js';
import type { AuthenticatedRequest } from '../../../identity/infrastructure/http/types/authenticated-request.js';

@Controller('conversations/:id/messages')
export class MessagesController {
  constructor(private getMessageHistoryUseCase: GetMessageHistory) {}

  @Get()
  async getMessageHistory(
    @Param('id') conversationId: string,
    @Query() query: GetMessagesQueryDto,
    @Request() req: AuthenticatedRequest,
  ): Promise<{
    messages: Array<{
      messageId: string;
      senderId: string;
      text: string;
      createdAt: Date;
    }>;
    nextCursor: {
      before?: string;
      limit: number;
    } | null;
  }> {
    const requesterId = req.user?.id;
    if (!requesterId) {
      throw new BadRequestException('User not authenticated');
    }

    // Ensure limit is within bounds
    const limit = Math.min(query.limit || 50, 100);

    try {
      const result = await this.getMessageHistoryUseCase.execute({
        requesterId,
        conversationId,
        cursor: {
          before: query.before,
          limit,
        },
      });

      if (!result.isOk()) {
        const error = result.error;
        if (error instanceof RequesterNotAMemberError) {
          throw new BadRequestException('You are not a member of this conversation');
        }
        throw new BadRequestException('Failed to retrieve message history');
      }

      const response = result.value;
      return {
        messages: response.messages.map((msg) => ({
          messageId: msg.messageId,
          senderId: msg.senderId,
          text: msg.text,
          createdAt: msg.createdAt,
        })),
        nextCursor: response.nextCursor,
      };
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to retrieve message history');
    }
  }
}
