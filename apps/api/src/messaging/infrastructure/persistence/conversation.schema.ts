import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ConversationDocument = HydratedDocument<Conversation>;

@Schema({ collection: 'conversations', timestamps: true })
export class Conversation {
  /**
   * Conversation ID (UUID)
   */
  @Prop({ type: String })
  _id: string;

  /**
   * Conversation type: '1:1' for one-to-one, 'group' for group conversations
   */
  @Prop({ type: String, enum: ['1:1', 'group'], required: true })
  type: '1:1' | 'group';

  /**
   * Conversation name (required for groups, null for 1:1)
   */
  @Prop({ type: String, default: null })
  name: string | null;

  /**
   * Array of member user IDs
   */
  @Prop({ type: [String], required: true })
  memberIds: string[];

  /**
   * ID of the user who created the conversation
   */
  @Prop({ type: String, required: true })
  createdBy: string;

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

export const ConversationSchema = SchemaFactory.createForClass(Conversation);

// Index memberIds for efficient "find all conversations for user" queries
ConversationSchema.index({ memberIds: 1 });
