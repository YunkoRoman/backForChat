import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ collection: 'users', timestamps: true })
export class User {
  /**
   * User ID (UUID)
   */
  @Prop({ type: String })
  _id: string;

  /**
   * Email address (unique, lowercase)
   */
  @Prop({ type: String, required: true, unique: true })
  email: string;

  /**
   * Display name
   */
  @Prop({ type: String, required: true })
  displayName: string;

  /**
   * Password hash (argon2id, never plaintext)
   * This field is excluded from queries by default (select: false)
   */
  @Prop({ type: String, required: true, select: false })
  passwordHash: string;

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

export const UserSchema = SchemaFactory.createForClass(User);

// Exclude passwordHash from default queries for security
UserSchema.set('toJSON', {
  transform: (doc, ret) => {
    const result = ret as Partial<typeof ret>;
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete result.passwordHash;
    return result;
  },
});
