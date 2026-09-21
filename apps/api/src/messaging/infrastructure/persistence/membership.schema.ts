import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MembershipDocument = HydratedDocument<Membership>;

@Schema({ collection: 'memberships', timestamps: true })
export class Membership {
  /**
   * Conversation ID
   */
  @Prop({ type: String, required: true })
  conversationId: string;

  /**
   * User ID
   */
  @Prop({ type: String, required: true })
  userId: string;

  /**
   * Role of the member in the conversation ('owner' or 'member')
   */
  @Prop({ type: String, enum: ['owner', 'member'], default: 'member' })
  role: 'owner' | 'member';

  /**
   * ID of the last message the member has read (null if no message read yet)
   */
  @Prop({ type: String, default: null })
  lastReadMessageId: string | null;

  /**
   * Timestamp when the member joined the conversation
   */
  @Prop({ type: Date, required: true })
  joinedAt: Date;

  /**
   * Created at timestamp (auto-managed by Mongoose timestamps)
   */
  @Prop()
  createdAt: Date;

  /**
   * Updated at timestamp (auto-managed by Mongoose timestamps)
   */
  @Prop()
  updatedAt: Date;
}

export const MembershipSchema = SchemaFactory.createForClass(Membership);

// Unique compound index on (conversationId, userId) to prevent duplicate memberships
MembershipSchema.index({ conversationId: 1, userId: 1 }, { unique: true });
