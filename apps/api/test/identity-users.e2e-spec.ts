import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from '../src/app.module.js';

describe('Identity - User Directory (e2e)', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer | null = null;

  // Test users
  const users = Array.from({ length: 15 }, (_, i) => ({
    email: `user${i}@example.com`,
    password: 'UserPassword123',
    displayName: `Test User ${i}`,
  }));

  let accessTokens: { [key: string]: string } = {};

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

      // Register all test users
      for (const user of users) {
        const res = await request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .send(user)
          .expect(201);

        accessTokens[user.email] = res.body.accessToken;
      }
    } catch (error) {
      console.error('Failed to initialize test app:', error);
      throw error;
    }
  }, 120000);

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('GET /api/v1/users', () => {
    it('should list users excluding the requester, paginated', async () => {
      const requesterEmail = users[0].email;
      const requesterToken = accessTokens[requesterEmail];

      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${requesterToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('total');
      expect(res.body).toHaveProperty('limit');
      expect(res.body).toHaveProperty('offset');

      // Should return all users except the requester
      expect(res.body.total).toBe(users.length - 1);

      // First page should have default limit of 20 (or all users if less than 20)
      expect(res.body.users.length).toBeLessThanOrEqual(20);
      expect(res.body.users.length).toBe(Math.min(users.length - 1, 20));

      // Verify that requester is not in the list
      const requesterInList = res.body.users.find(
        (u: any) => u.email === requesterEmail.toLowerCase(),
      );
      expect(requesterInList).toBeUndefined();

      // Verify user structure
      if (res.body.users.length > 0) {
        const user = res.body.users[0];
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('displayName');
        expect(user).toHaveProperty('createdAt');
        expect(user).not.toHaveProperty('password');
        expect(user).not.toHaveProperty('passwordHash');
      }
    });

    it('should support pagination with limit parameter', async () => {
      const requesterToken = accessTokens[users[1].email];

      const res = await request(app.getHttpServer())
        .get('/api/v1/users?limit=5')
        .set('Authorization', `Bearer ${requesterToken}`)
        .expect(200);

      expect(res.body.users.length).toBeLessThanOrEqual(5);
      expect(res.body.limit).toBe(5);
      expect(res.body.offset).toBe(0);
    });

    it('should support pagination with offset parameter', async () => {
      const requesterToken = accessTokens[users[2].email];

      // First, get page 0
      const page0 = await request(app.getHttpServer())
        .get('/api/v1/users?limit=5')
        .set('Authorization', `Bearer ${requesterToken}`)
        .expect(200);

      const firstPageEmails = page0.body.users.map((u: any) => u.email);

      // Then get page 1
      const page1 = await request(app.getHttpServer())
        .get('/api/v1/users?limit=5&offset=5')
        .set('Authorization', `Bearer ${requesterToken}`)
        .expect(200);

      const secondPageEmails = page1.body.users.map((u: any) => u.email);

      // Pages should be different (unless we hit the end)
      if (page0.body.total > 5) {
        expect(firstPageEmails).not.toEqual(secondPageEmails);
      }

      expect(page1.body.offset).toBe(5);
    });

    it('should cap limit at 100 and enforce defaults', async () => {
      const requesterToken = accessTokens[users[3].email];

      // Request with limit > 100 should be capped at 100
      const res = await request(app.getHttpServer())
        .get('/api/v1/users?limit=200')
        .set('Authorization', `Bearer ${requesterToken}`)
        .expect(200);

      expect(res.body.limit).toBeLessThanOrEqual(100);
    });

    it('should reject invalid limit parameter', async () => {
      const requesterToken = accessTokens[users[4].email];

      const res = await request(app.getHttpServer())
        .get('/api/v1/users?limit=invalid')
        .set('Authorization', `Bearer ${requesterToken}`)
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('should reject negative offset parameter', async () => {
      const requesterToken = accessTokens[users[5].email];

      const res = await request(app.getHttpServer())
        .get('/api/v1/users?offset=-1')
        .set('Authorization', `Bearer ${requesterToken}`)
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('should return empty list when offset exceeds total', async () => {
      const requesterToken = accessTokens[users[6].email];

      const res = await request(app.getHttpServer())
        .get(`/api/v1/users?offset=${users.length * 10}`)
        .set('Authorization', `Bearer ${requesterToken}`)
        .expect(200);

      expect(res.body.users.length).toBe(0);
      expect(res.body.total).toBe(users.length - 1);
    });

    it('should reject unauthenticated request', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .expect(401);

      expect(res.body.message).toBeDefined();
    });

    it('should reject request with invalid access token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(res.body.message).toBeDefined();
    });

    it('should list different users from different requesters', async () => {
      const requester1Token = accessTokens[users[7].email];
      const requester2Token = accessTokens[users[8].email];

      // limit covers all 15 seeded users so pagination can't cut either
      // requester out of the other's page (that's not what this test
      // is checking — see the dedicated pagination test above).
      const list1 = await request(app.getHttpServer())
        .get('/api/v1/users?limit=20')
        .set('Authorization', `Bearer ${requester1Token}`)
        .expect(200);

      const list2 = await request(app.getHttpServer())
        .get('/api/v1/users?limit=20')
        .set('Authorization', `Bearer ${requester2Token}`)
        .expect(200);

      // Both lists should not include their respective requester
      const requester1InList2 = list2.body.users.find(
        (u: any) => u.email === users[7].email.toLowerCase(),
      );
      const requester2InList1 = list1.body.users.find(
        (u: any) => u.email === users[8].email.toLowerCase(),
      );

      expect(requester1InList2).toBeDefined(); // Requester 1 should be in requester 2's list
      expect(requester2InList1).toBeDefined(); // Requester 2 should be in requester 1's list
    });

    it('should never include the requester in their own list', async () => {
      for (let i = 0; i < Math.min(5, users.length); i++) {
        const requesterEmail = users[i].email;
        const requesterToken = accessTokens[requesterEmail];

        const res = await request(app.getHttpServer())
          .get('/api/v1/users?limit=100')
          .set('Authorization', `Bearer ${requesterToken}`)
          .expect(200);

        const selfInList = res.body.users.find(
          (u: any) => u.email === requesterEmail.toLowerCase(),
        );

        expect(selfInList).toBeUndefined();
      }
    });

    it('should return consistent total count across paginated requests', async () => {
      const requesterToken = accessTokens[users[9].email];

      const page1 = await request(app.getHttpServer())
        .get('/api/v1/users?limit=5')
        .set('Authorization', `Bearer ${requesterToken}`)
        .expect(200);

      const page2 = await request(app.getHttpServer())
        .get('/api/v1/users?limit=5&offset=5')
        .set('Authorization', `Bearer ${requesterToken}`)
        .expect(200);

      // Total count should be the same across pages
      expect(page1.body.total).toBe(page2.body.total);
      expect(page1.body.total).toBe(users.length - 1);
    });
  });
});
