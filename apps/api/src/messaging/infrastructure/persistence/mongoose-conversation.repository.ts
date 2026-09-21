import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConversationRepository } from '../../application/ports/conversation-repository.interface.js';
import { Conversation as ConversationAggregate } from '../../domain/conversation.aggregate.js';
import { Conversation as ConversationDocument, ConversationDocument as ConversationDocType } from './conversation.schema.js';
import { MembershipDocument as MembershipDocType } from './membership.schema.js';

@Injectable()
export class MongooseConversationRepository implements ConversationRepository {
  constructor(
    @InjectModel('Conversation')
    private conversationModel: Model<ConversationDocType>,
    @InjectModel('Membership')
    private membershipModel: Model<MembershipDocType>,
  ) {}

  async findById(id: string): Promise<ConversationAggregate | null> {
    const doc = await this.conversationModel.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async save(conversation: ConversationAggregate): Promise<void> {
    const doc = this.toPersistence(conversation);

    // Save the conversation document
    await this.conversationModel.findByIdAndUpdate(conversation.id, doc, { upsert: true }).exec();

    // Upsert Membership documents for each member
    const now = new Date();
    const membershipOps = conversation.memberIds.map((memberId) => ({
      updateOne: {
        filter: { conversationId: conversation.id, userId: memberId },
        update: {
          $setOnInsert: {
            conversationId: conversation.id,
            userId: memberId,
            role: memberId === conversation.createdBy ? 'owner' : 'member',
            lastReadMessageId: null,
            joinedAt: now,
            createdAt: now,
          },
          $set: {
            updatedAt: now,
          },
        },
        upsert: true,
      },
    }));

    if (membershipOps.length > 0) {
      await this.membershipModel.bulkWrite(membershipOps as any);
    }
  }

  async delete(id: string): Promise<void> {
    await this.conversationModel.findByIdAndDelete(id).exec();
    // Also delete all memberships for this conversation
    await this.membershipModel.deleteMany({ conversationId: id }).exec();
  }

  /**
   * Find a 1:1 conversation between two specific users.
   * Query the Conversation collection directly since we need to check for exact match of two members.
   */
  async findOneToOneBetween(userIdA: string, userIdB: string): Promise<ConversationAggregate | null> {
    const doc = await this.conversationModel
      .findOne({
        type: '1:1',
        memberIds: { $all: [userIdA, userIdB] },
      })
      .exec();

    if (!doc) return null;
    return this.toDomain(doc);
  }

  /**
   * Find all conversations a user is a member of.
   * Query the Conversation collection, filtering by memberIds array since memberIds is the source of truth.
   * This is more direct than querying Membership since we need to return full Conversation objects anyway.
   */
  async findAllForUser(userId: string): Promise<ConversationAggregate[]> {
    const docs = await this.conversationModel
      .find({ memberIds: userId })
      .exec();

    return docs.map((doc) => this.toDomain(doc));
  }

  private toDomain(doc: ConversationDocType): ConversationAggregate {
    return new ConversationAggregate(
      doc._id,
      doc.type,
      doc.memberIds,
      doc.createdBy,
      doc.createdAt,
      doc.name,
    );
  }

  private toPersistence(conversation: ConversationAggregate): Partial<ConversationDocument> {
    return {
      _id: conversation.id,
      type: conversation.type,
      name: conversation.name,
      memberIds: conversation.memberIds,
      createdBy: conversation.createdBy,
      createdAt: conversation.createdAt,
    };
  }
}
