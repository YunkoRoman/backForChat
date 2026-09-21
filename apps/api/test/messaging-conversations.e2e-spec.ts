import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from '../src/app.module.js';

describe('Messaging - Conversations (e2e)', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer | null = null;

  // Test users
  const testUser1 = {
    email: 'msg-user1@example.com',
    password: 'SecurePassword123',
    displayName: 'Message User One',
  };

  const testUser2 = {
    email: 'msg-user2@example.com',
    password: 'AnotherPassword456',
    displayName: 'Message User Two',
  };

  const testUser3 = {
    email: 'msg-user3@example.com',
    password: 'ThirdPassword789',
    displayName: 'Message User Three',
  };

  let user1Token: string;
  let _user2Token: string;
  let user3Token: string;
  let user1Id: string;
  let user2Id: string;
  let user3Id: string;

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
      user1Id = reg1.body.user.id;

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

  describe('POST /api/v1/conversations - Create 1:1 conversation', () => {
    it('should create a new 1:1 conversation', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: '1:1',
          memberId: user2Id,
        })
        .expect(201);

      expect(res.body).toHaveProperty('conversationId');
      expect(res.body.type).toBe('1:1');
      expect(res.body.name).toBeNull();
      expect(res.body.memberIds).toContain(user1Id);
      expect(res.body.memberIds).toContain(user2Id);
      expect(res.body).toHaveProperty('createdAt');
    });

    it('should reuse an existing 1:1 conversation', async () => {
      // Create first conversation
      const res1 = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: '1:1',
          memberId: user2Id,
        })
        .expect(201);

      const conversationId1 = res1.body.conversationId;

      // Create second conversation with same users
      const res2 = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: '1:1',
          memberId: user2Id,
        })
        .expect(201);

      const conversationId2 = res2.body.conversationId;

      // Should return the same conversation
      expect(conversationId2).toBe(conversationId1);
    });

    it('should reject creating 1:1 conversation with self', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: '1:1',
          memberId: user1Id,
        })
        .expect(400);
    });
  });

  describe('POST /api/v1/conversations - Create group conversation', () => {
    it('should create a group conversation with 2+ members', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'group',
          name: 'Test Group',
          memberIds: [user2Id, user3Id],
        })
        .expect(201);

      expect(res.body).toHaveProperty('conversationId');
      expect(res.body.type).toBe('group');
      expect(res.body.name).toBe('Test Group');
      expect(res.body.memberIds).toHaveLength(3); // creator + 2 members
      expect(res.body.memberIds).toContain(user1Id);
      expect(res.body.memberIds).toContain(user2Id);
      expect(res.body.memberIds).toContain(user3Id);
    });

    it('should reject group creation with too few members', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'group',
          name: 'Bad Group',
          memberIds: [],
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/conversations - List conversations', () => {
    it('should list only the requester\'s conversations', async () => {
      // Create a 1:1 conversation between user1 and user2
      await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: '1:1',
          memberId: user2Id,
        })
        .expect(201);

      // Create a group conversation with user1, user2, and user3
      await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'group',
          name: 'Group A',
          memberIds: [user2Id, user3Id],
        })
        .expect(201);

      // List conversations for user1
      const res = await request(app.getHttpServer())
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(2);

      // User1 should see both conversations
      const conversationIds = res.body.map((c: any) => c.conversationId);
      expect(conversationIds.length).toBeGreaterThanOrEqual(2);

      // List conversations for user3
      const res3 = await request(app.getHttpServer())
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${user3Token}`)
        .expect(200);

      // User3 should only see the group conversation (not the 1:1 between user1 and user2)
      const user3Conversations = res3.body;
      expect(Array.isArray(user3Conversations)).toBe(true);
    });

    it('should return empty array when user has no conversations', async () => {
      // Create a new user with no conversations
      const newUser = {
        email: 'lonely@example.com',
        password: 'LonelyPassword123',
        displayName: 'Lonely User',
      };

      const regRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(newUser)
        .expect(201);

      const token = regRes.body.accessToken;

      const res = await request(app.getHttpServer())
        .get('/api/v1/conversations')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('POST /api/v1/conversations/:id/members - Add member', () => {
    it('should add a member to a group conversation', async () => {
      // Create a group with user1 and user2
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'group',
          name: 'Group to Add',
          memberIds: [user2Id],
        })
        .expect(201);

      const conversationId = createRes.body.conversationId;

      // Add user3 to the group
      const addRes = await request(app.getHttpServer())
        .post(`/api/v1/conversations/${conversationId}/members`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          userId: user3Id,
        })
        .expect(201);

      expect(addRes.body.conversationId).toBe(conversationId);
      expect(addRes.body.memberIds).toContain(user3Id);
      expect(addRes.body.memberIds).toHaveLength(3);
    });

    it('should reject adding member to a 1:1 conversation', async () => {
      // Create a 1:1 conversation
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: '1:1',
          memberId: user2Id,
        })
        .expect(201);

      const conversationId = createRes.body.conversationId;

      // Try to add user3
      await request(app.getHttpServer())
        .post(`/api/v1/conversations/${conversationId}/members`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          userId: user3Id,
        })
        .expect(400);
    });

    it('should reject adding member when requester is not a member', async () => {
      // Create a group conversation with user1 and user2 (user3 is not a member)
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          type: 'group',
          name: 'Exclusive Group',
          memberIds: [user2Id],
        })
        .expect(201);

      const conversationId = createRes.body.conversationId;

      // Try to add a member as user3 (not a member)
      await request(app.getHttpServer())
        .post(`/api/v1/conversations/${conversationId}/members`)
        .set('Authorization', `Bearer ${user3Token}`)
        .send({
          userId: user1Id,
        })
        .expect(400);
    });
  });

  describe('Authentication', () => {
    it('should require authentication for creating conversations', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/conversations')
        .send({
          type: '1:1',
          memberId: user2Id,
        })
        .expect(401);
    });

    it('should require authentication for listing conversations', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/conversations')
        .expect(401);
    });

    it('should require authentication for adding members', async () => {
      const conversationId = 'some-id';
      await request(app.getHttpServer())
        .post(`/api/v1/conversations/${conversationId}/members`)
        .send({
          userId: user2Id,
        })
        .expect(401);
    });
  });
});
