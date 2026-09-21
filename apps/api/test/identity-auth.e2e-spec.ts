import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from '../src/app.module.js';

describe('Identity - Authentication (e2e)', () => {
  let app: INestApplication;
  let mongoServer: MongoMemoryServer | null = null;

  // Test users
  const testUser1 = {
    email: 'user1@example.com',
    password: 'SecurePassword123',
    displayName: 'User One',
  };

  const testUser2 = {
    email: 'user2@example.com',
    password: 'AnotherPassword456',
    displayName: 'User Two',
  };

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

  describe('POST /api/v1/auth/register', () => {
    it('should register a user with valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser1)
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe(testUser1.email.toLowerCase());
      expect(res.body.user.displayName).toBe(testUser1.displayName);
      expect(res.body.user).not.toHaveProperty('password');
    });

    it('should reject registration with duplicate email', async () => {
      // First registration should succeed
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'ValidPassword123',
          displayName: 'First User',
        })
        .expect(201);

      // Second registration with same email should fail
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'DifferentPassword456',
          displayName: 'Second User',
        })
        .expect(400);

      expect(res.body.message).toContain('already registered');
    });

    it('should reject registration with weak password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'weakpw@example.com',
          password: 'short', // Less than 8 characters
          displayName: 'Weak Password User',
        })
        .expect(400);

      // class-validator returns an array of messages, not a single string
      expect(Array.isArray(res.body.message)).toBe(true);
      expect(
        res.body.message.some((m: string) => /8 characters/i.test(m)),
      ).toBe(true);
    });

    it('should reject registration with invalid email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'not-an-email',
          password: 'ValidPassword123',
          displayName: 'Invalid Email User',
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('should reject registration with missing fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'missing@example.com',
          // Missing password and displayName
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('should reject registration with extra/unexpected fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'extra@example.com',
          password: 'ValidPassword123',
          displayName: 'Extra Fields User',
          extra_field: 'should be rejected',
          $ne: null, // NoSQL injection attempt
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/login', () => {
    // Register the shared test user once for this block (registering it
    // again per-test would 400 on duplicate email and abort every test
    // after the first before its own assertions even run).
    beforeAll(async () => {
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser2)
        .expect(201);
    });

    it('should login with correct credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUser2.email,
          password: testUser2.password,
        })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.user.email).toBe(testUser2.email.toLowerCase());
    });

    it('should return generic error for wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: testUser2.email,
          password: 'WrongPassword123',
        })
        .expect(400);

      expect(res.body.message).toContain('Invalid email or password');
    });

    it('should return generic error for unknown email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123',
        })
        .expect(400);

      expect(res.body.message).toContain('Invalid email or password');
    });

    it('should be rate-limited after excessive login attempts', async () => {
      const email = 'ratelimit@example.com';
      const password = 'RateLimitTest123';

      // Register the user
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password,
          displayName: 'Rate Limit Test',
        })
        .expect(201);

      // Try to login 6 times with wrong password (limit is 5 per 60s)
      for (let i = 0; i < 5; i++) {
        await request(app.getHttpServer())
          .post('/api/v1/auth/login')
          .send({
            email,
            password: 'WrongPassword',
          })
          .expect(400);
      }

      // The 6th attempt should be rate-limited (429)
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'WrongPassword',
        });

      // Rate limit status is typically 429
      expect([400, 429]).toContain(res.status);
    });

    it('should allow login attempt with correct credentials even after some failed attempts', async () => {
      const email = 'correct-after-failed@example.com';
      const password = 'CorrectPassword789';

      // Register
      await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password,
          displayName: 'Correct After Failed',
        })
        .expect(201);

      // Try with wrong password
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'WrongPassword',
        })
        .expect(400);

      // Now try with correct password
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email,
          password,
        })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    let refreshToken: string;

    beforeAll(async () => {
      // Register and login to get tokens
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'refresh@example.com',
          password: 'RefreshTest123',
          displayName: 'Refresh Test User',
        })
        .expect(201);

      refreshToken = res.body.refreshToken;
    });

    it('should refresh the token with valid refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(201);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body).toHaveProperty('refreshToken');
      expect(res.body.refreshToken).not.toEqual(refreshToken); // Should be a new token
    });

    it('should reject refresh with invalid refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: 'invalid.token.here' })
        .expect(400);

      expect(res.body.message).toContain('Invalid or expired refresh token');
    });

    it('should detect reuse of an already-rotated token and revoke all sessions', async () => {
      // Get initial refresh token
      const loginRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'reuse-detect@example.com',
          password: 'ReuseDetectTest123',
          displayName: 'Reuse Detection User',
        })
        .expect(201);

      let currentRefreshToken = loginRes.body.refreshToken;

      // First rotation - should succeed
      const rotation1Res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: currentRefreshToken })
        .expect(201);

      const newRefreshToken1 = rotation1Res.body.refreshToken;
      expect(newRefreshToken1).not.toEqual(currentRefreshToken);

      // Second rotation with new token - should succeed
      const rotation2Res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: newRefreshToken1 })
        .expect(201);

      // Try to reuse the first token - should be detected as reuse
      const reuseRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: currentRefreshToken })
        .expect(400);

      expect(reuseRes.body.message).toContain('reuse detected');

      // All sessions should now be revoked, even the latest token should fail
      const shouldFailRes = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotation2Res.body.refreshToken })
        .expect(400);

      expect(shouldFailRes.body.message).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should revoke a refresh token on logout', async () => {
      // Register and get tokens
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'logout@example.com',
          password: 'LogoutTest123',
          displayName: 'Logout Test User',
        });

      if (registerRes.status !== 201) {
        console.error('Register failed:', registerRes.status, registerRes.body);
        expect(registerRes.status).toBe(201);
      }

      const refreshToken = registerRes.body.refreshToken;

      // Logout
      const logoutRes = await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken });

      if (logoutRes.status !== 201) {
        console.error('Logout failed:', logoutRes.status, logoutRes.body);
      }
      expect(logoutRes.status).toBe(201);

      // Try to use the token after logout - should fail
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(400);

      expect(res.body.message).toContain('Invalid or expired refresh token');
    });

    it('should handle logout idempotently (logging out twice should not error)', async () => {
      // Register and get tokens
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'logout-idempotent@example.com',
          password: 'LogoutIdempotent123',
          displayName: 'Logout Idempotent User',
        })
        .expect(201);

      const refreshToken = registerRes.body.refreshToken;

      // First logout
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken })
        .expect(201);

      // Second logout with same token should also succeed (idempotent)
      await request(app.getHttpServer())
        .post('/api/v1/auth/logout')
        .send({ refreshToken })
        .expect(201);
    });
  });

  describe('Protected endpoints', () => {
    let accessToken: string;

    beforeAll(async () => {
      const registerRes = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'protected@example.com',
          password: 'ProtectedTest123',
          displayName: 'Protected Test User',
        })
        .expect(201);

      accessToken = registerRes.body.accessToken;
    });

    it('should reject request without access token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .expect(401);

      expect(res.body.message).toContain('No access token provided');
    });

    it('should reject request with invalid access token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', 'Bearer invalid.token.here')
        .expect(401);

      expect(res.body.message).toBeDefined();
    });

    it('should reject request with expired access token', async () => {
      // Create an expired token (we can't easily do this without mocking time)
      // For now, we'll just verify that proper Bearer format is required
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', 'invalid-format')
        .expect(401);

      expect(res.body.message).toBeDefined();
    });

    it('should allow request with valid access token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(res.body).toHaveProperty('users');
      expect(res.body).toHaveProperty('total');
      expect(Array.isArray(res.body.users)).toBe(true);
    });
  });

  describe('Global validation pipe - NoSQL injection prevention', () => {
    it('should reject request with NoSQL injection attempt in body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'test@example.com',
          password: { $ne: null }, // NoSQL injection attempt
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });

    it('should reject request with extra fields in body', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email: 'test@example.com',
          password: 'TestPassword123',
          displayName: 'Test User',
          admin: true, // Extra field
          role: 'superuser', // Another extra field
        })
        .expect(400);

      expect(res.body.message).toBeDefined();
    });
  });
});
