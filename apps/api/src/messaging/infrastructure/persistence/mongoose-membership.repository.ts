import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MembershipRepository, MembershipRecord } from '../../application/ports/membership-repository.interface.js';
import { MembershipDocument as MembershipDocType } from './membership.schema.js';

@Injectable()
export class MongooseMembershipRepository implements MembershipRepository {
  constructor(
    @InjectModel('Membership')
    private membershipModel: Model<MembershipDocType>,
  ) {}

  async findByConversationAndUser(
    conversationId: string,
    userId: string,
  ): Promise<MembershipRecord | null> {
    const doc = await this.membershipModel.findOne({
      conversationId,
      userId,
    }).exec();

    if (!doc) return null;

    return {
      conversationId: doc.conversationId,
      userId: doc.userId,
      lastReadMessageId: doc.lastReadMessageId,
    };
  }

  async updateLastReadMessageId(
    conversationId: string,
    userId: string,
    messageId: string,
  ): Promise<void> {
    await this.membershipModel.findOneAndUpdate(
      { conversationId, userId },
      { $set: { lastReadMessageId: messageId } },
    ).exec();
  }
}
