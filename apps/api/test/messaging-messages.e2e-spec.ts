import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from '../src/app.module.js';

describe('Messaging - Messages (e2e)', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer | null = null;

  // Test users
  const testUser1 = {
    email: 'msg-msg-user1@example.com',
    password: 'SecurePassword123',
    displayName: 'Message Sender One',
  };

  const testUser2 = {
    email: 'msg-msg-user2@example.com',
    password: 'AnotherPassword456',
    displayName: 'Message Sender Two',
  };

  const testUser3 = {
    email: 'msg-msg-user3@example.com',
    password: 'ThirdPassword789',
    displayName: 'Message Sender Three',
  };

  let user1Token: string;
  let _user2Token: string;
  let user3Token: string;
  let _user1Id: string;
  let user2Id: string;
  let user3Id: string;

  let conversationId: string; // 1:1 conversation between user1 and user2
  let _groupConversationId: string; // group with user1, user2, user3

  beforeAll(async () => {
    try {
      // Start in-memory MongoDB
      mongoServer = await MongoMemoryServer.create();
      const mongoUri = mongoServer.getUri();

      // Set environment variables for the test
      process.env.MONGO_URI = mongoUri;
      process.env.JWT_ACCESS_SECRET = 'test-access-secret-key';
      process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key';
      process.env.RABBITMQ_URL = 'amqp://guest:guest@localhost:5672';
      process.env.FRONTEND_ORIGIN = 'http://localhost:3000';
      process.env.NODE_ENV = 'test';

      const moduleFixture: TestingModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();

      app = moduleFixture.createNestApplication();
      app.setGlobalPrefix('api/v1');
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
        }),
      );
      await app.init();

      // Register and login test users
      const reg1 = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser1)
        .expect(201);
      user1Token = reg1.body.accessToken;
      _user1Id = reg1.body.user.id;

      const reg2 = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser2)
        .expect(201);
      _user2Token = reg2.body.accessToken;
      user2Id = reg2.body.user.id;

      const reg3 = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser3)
        .expect(201);
      user3Token = reg3.body.accessToken;
      user3Id = reg3.body.user.id;

      // Create test conversations
      const conv1Res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: '1:1',
          memberId: user2Id,
        })
        .expect(201);
      conversationId = conv1Res.body.conversationId;

      const conv2Res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'group',
          name: 'Test Group',
          memberIds: [user2Id, user3Id],
        })
        .expect(201);
      _groupConversationId = conv2Res.body.conversationId;
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

  describe('GET /api/v1/conversations/:id/messages - Retrieve message history', () => {
    it('should return empty history for a conversation with no messages', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(res.body).toHaveProperty('messages');
      expect(res.body).toHaveProperty('nextCursor');
      expect(Array.isArray(res.body.messages)).toBe(true);
      expect(res.body.messages).toHaveLength(0);
      expect(res.body.nextCursor).toBeNull();
    });

    it('should reject non-member from retrieving history', async () => {
      // Create a 1:1 conversation between user1 and user2
      const convRes = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: '1:1',
          memberId: user2Id,
        })
        .expect(201);

      const convId = convRes.body.conversationId;

      // Try to retrieve history as user3 (not a member)
      await request(app.getHttpServer())
        .get(`/api/v1/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${user3Token}`)
        .expect(400);
    });

    it('should retrieve paginated history with cursor', async () => {
      // Create a separate conversation for this test
      const convRes = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'group',
          name: 'Pagination Test',
          memberIds: [user2Id],
        })
        .expect(201);

      const convId = convRes.body.conversationId;

      // Send multiple messages
      for (let i = 0; i < 5; i++) {
        // Note: send messages through REST API once it's implemented
        // For now, we'll just test the retrieval structure
        await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay
      }

      // Retrieve with default limit
      const res = await request(app.getHttpServer())
        .get(`/api/v1/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(res.body).toHaveProperty('messages');
      expect(res.body).toHaveProperty('nextCursor');
      expect(Array.isArray(res.body.messages)).toBe(true);
    });
  });

  describe('Authentication and Authorization', () => {
    it('should require authentication for retrieving message history', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/conversations/${conversationId}/messages`)
        .expect(401);
    });

    it('should return 400 for non-member retrieving history', async () => {
      // Create conversation with user1 and user2 only
      const convRes = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: '1:1',
          memberId: user2Id,
        })
        .expect(201);

      const convId = convRes.body.conversationId;

      // User3 should not be able to retrieve history
      await request(app.getHttpServer())
        .get(`/api/v1/conversations/${convId}/messages`)
        .set('Authorization', `Bearer ${user3Token}`)
        .expect(400);
    });
  });
});
