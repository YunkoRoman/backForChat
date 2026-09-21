import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { MessageRepository, MessageCursor, MessagePage } from '../../application/ports/message-repository.interface.js';
import { Message as MessageAggregate } from '../../domain/message.entity.js';
import { Message as MessageDocument, MessageDocument as MessageDocType } from './message.schema.js';

@Injectable()
export class MongooseMessageRepository implements MessageRepository {
  constructor(
    @InjectModel('Message')
    private messageModel: Model<MessageDocType>,
  ) {}

  async findById(id: string): Promise<MessageAggregate | null> {
    const doc = await this.messageModel.findById(id).exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async save(message: MessageAggregate): Promise<void> {
    const doc = this.toPersistence(message);
    await this.messageModel.findByIdAndUpdate(message.id, doc, { upsert: true }).exec();
  }

  async delete(id: string): Promise<void> {
    await this.messageModel.findByIdAndDelete(id).exec();
  }

  /**
   * Find messages for a conversation with cursor-based pagination.
   * Returns messages in reverse-chronological order (newest first).
   *
   * Query strategy:
   * - If no 'before' cursor: get the latest `limit` messages
   * - If 'before' cursor provided: get messages before that message ID, limited to `limit` count
   *
   * Uses (conversationId, createdAt) compound index for efficient retrieval.
   */
  async findByConversationId(
    conversationId: string,
    cursor: MessageCursor,
  ): Promise<MessagePage> {
    const { before, limit } = cursor;

    // Fetch one extra message to determine if there are more pages
    const fetchLimit = limit + 1;

    let query = this.messageModel.find({ conversationId });

    if (before) {
      // Find the reference message to get its timestamp for pagination
      const referenceMessage = await this.messageModel.findById(before).exec();
      if (referenceMessage) {
        // Find messages created before the reference message
        query = query.find({
          createdAt: { $lt: referenceMessage.createdAt },
        });
      }
    }

    const docs = await query
      .sort({ createdAt: -1 }) // Newest first
      .limit(fetchLimit)
      .exec();

    // Check if there are more pages
    let hasMore = false;
    let resultsToReturn = docs;
    if (docs.length > limit) {
      hasMore = true;
      resultsToReturn = docs.slice(0, limit);
    }

    const messages = resultsToReturn.map((doc) => this.toDomain(doc));

    const nextCursor: MessageCursor | null = hasMore
      ? {
          before: messages[messages.length - 1]?.id,
          limit,
        }
      : null;

    return {
      messages,
      nextCursor,
    };
  }

  private toDomain(doc: MessageDocType): MessageAggregate {
    return new MessageAggregate(
      doc._id,
      doc.conversationId,
      doc.senderId,
      doc.text,
      doc.createdAt,
    );
  }

  private toPersistence(message: MessageAggregate): Partial<MessageDocument> {
    return {
      _id: message.id,
      conversationId: message.conversationId,
      senderId: message.senderId,
      text: message.text,
      createdAt: message.createdAt,
    };
  }
}
