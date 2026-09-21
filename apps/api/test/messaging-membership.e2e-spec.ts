import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule } from '@nestjs/mongoose';
import { MembershipSchema as MembershipSchemaFactory } from '../src/messaging/infrastructure/persistence/membership.schema.js';

describe('Messaging - Membership Unique Index (Integration)', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer | null = null;

  beforeAll(async () => {
    try {
      // Start in-memory MongoDB
      mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [
          MongooseModule.forRoot(mongoUri),
          MongooseModule.forFeature([
            { name: 'Membership', schema: MembershipSchemaFactory },
          ]),
        ],
      }).compile();

      app = moduleFixture.createNestApplication();
      await app.init();
    } catch (error) {
      console.error('Failed to initialize test app:', error);
      throw error;
    }
  }, 60000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('Membership unique index', () => {
    it('should reject duplicate (conversationId, userId) inserts', async () => {
      const membershipModel = app.get('MembershipModel');

      const conversationId = 'conv-123';
      const userId = 'user-456';
      const joinedAt = new Date();

      // First insert should succeed
      await membershipModel.create({
        conversationId,
        userId,
        role: 'member',
        lastReadMessageId: null,
        joinedAt,
      });

      // Second insert with same (conversationId, userId) should fail
      let errorThrown = false;
      try {
        await membershipModel.create({
          conversationId,
          userId,
          role: 'member',
          lastReadMessageId: null,
          joinedAt,
        });
      } catch (error: any) {
        // MongoDB unique index error
        if (error.code === 11000) {
          errorThrown = true;
        }
      }

      expect(errorThrown).toBe(true);
    });
  });
});
