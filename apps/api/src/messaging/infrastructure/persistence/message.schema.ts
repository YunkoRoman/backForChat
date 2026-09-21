import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type MessageDocument = HydratedDocument<Message>;

@Schema({ collection: 'messages', timestamps: true })
export class Message {
  /**
   * Message ID (UUID)
   */
  @Prop({ type: String })
  _id: string;

  /**
   * Conversation ID
   */
  @Prop({ type: String, required: true })
  conversationId: string;

  /**
   * User ID of the message sender
   */
  @Prop({ type: String, required: true })
  senderId: string;

  /**
   * Message text content
   */
  @Prop({ type: String, required: true })
  text: string;

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

export const MessageSchema = SchemaFactory.createForClass(Message);

// Compound index on (conversationId, createdAt) for efficient history retrieval
MessageSchema.index({ conversationId: 1, createdAt: -1 });
