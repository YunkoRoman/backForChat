import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { RefreshTokenDocument as RefreshTokenDocType } from './refresh-token.schema.js';

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  replacedByTokenId?: string;
}

@Injectable()
export class RefreshTokenRepository {
  constructor(
    @InjectModel('RefreshToken')
    private refreshTokenModel: Model<RefreshTokenDocType>,
  ) {}

  /**
   * Save a new refresh token record
   */
  async save(record: RefreshTokenRecord): Promise<void> {
    await this.refreshTokenModel.create({
      _id: record.id,
      userId: record.userId,
      tokenHash: record.tokenHash,
      expiresAt: record.expiresAt,
      replacedByTokenId: record.replacedByTokenId,
    });
  }

  /**
   * Find a refresh token record by ID
   */
  async findById(id: string): Promise<RefreshTokenRecord | null> {
    const doc = await this.refreshTokenModel.findById(id).exec();
    if (!doc) return null;

    return {
      id: doc._id,
      userId: doc.userId,
      tokenHash: doc.tokenHash,
      expiresAt: doc.expiresAt,
      replacedByTokenId: doc.replacedByTokenId,
    };
  }

  /**
   * Mark a token as replaced by another token
   * Used when rotating a token to track what replaced it
   */
  async markAsReplaced(tokenId: string, replacedByTokenId: string): Promise<void> {
    await this.refreshTokenModel
      .findByIdAndUpdate(tokenId, { replacedByTokenId })
      .exec();
  }

  /**
   * Revoke all refresh tokens for a user
   * Used when reuse is detected or on explicit logout needs revocation
   */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.refreshTokenModel.deleteMany({ userId }).exec();
  }

  /**
   * Revoke a specific refresh token by ID
   * Used on logout
   */
  async revoke(tokenId: string): Promise<void> {
    await this.refreshTokenModel.findByIdAndDelete(tokenId).exec();
  }

  /**
   * Delete all expired tokens (cleanup)
   */
  async deleteExpired(): Promise<void> {
    await this.refreshTokenModel.deleteMany({ expiresAt: { $lt: new Date() } }).exec();
  }
}
