import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserRepository } from '../../application/ports/user-repository.interface.js';
import { User as UserAggregate } from '../../domain/user.aggregate.js';
import { Email } from '../../domain/email.value-object.js';
import { Credentials } from '../../domain/credentials.value-object.js';
import { User as UserDocument, UserDocument as UserDocType } from './user.schema.js';

@Injectable()
export class MongooseUserRepository implements UserRepository {
  constructor(
    @InjectModel('User')
    private userModel: Model<UserDocType>,
  ) {}

  async findById(id: string): Promise<UserAggregate | null> {
    const doc = await this.userModel.findById(id).select('+passwordHash').exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async findByEmail(email: string): Promise<UserAggregate | null> {
    const doc = await this.userModel.findOne({ email: email.toLowerCase() }).select('+passwordHash').exec();
    if (!doc) return null;
    return this.toDomain(doc);
  }

  async save(user: UserAggregate): Promise<void> {
    const doc = this.toPersistence(user);
    await this.userModel.findByIdAndUpdate(user.id, doc, { upsert: true }).exec();
  }

  async delete(id: string): Promise<void> {
    await this.userModel.findByIdAndDelete(id).exec();
  }

  /**
   * Find all users except the one with the given ID, with pagination
   * @param excludeUserId The user ID to exclude from results
   * @param limit Maximum number of users to return
   * @param offset Number of users to skip
   */
  async findAllExcept(
    excludeUserId: string,
    limit: number,
    offset: number,
  ): Promise<{ users: UserAggregate[]; total: number }> {
    const [docs, total] = await Promise.all([
      this.userModel
        .find({ _id: { $ne: excludeUserId } })
        .select('+passwordHash')
        .limit(limit)
        .skip(offset)
        .exec(),
      this.userModel.countDocuments({ _id: { $ne: excludeUserId } }).exec(),
    ]);

    return {
      users: docs.map((doc) => this.toDomain(doc)),
      total,
    };
  }

  private toDomain(doc: UserDocType): UserAggregate {
    return new UserAggregate(
      doc._id,
      new Email(doc.email),
      doc.displayName,
      new Credentials(doc.passwordHash),
      doc.createdAt,
    );
  }

  private toPersistence(user: UserAggregate): Partial<UserDocument> {
    return {
      _id: user.id,
      email: user.email.value.toLowerCase(),
      displayName: user.displayName,
      passwordHash: user.credentials.hash,
      createdAt: user.createdAt,
    };
  }
}
