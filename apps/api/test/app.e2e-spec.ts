import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { AppModule } from './../src/app.module.js';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let mongoServer: MongoMemoryServer | null = null;

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
    } catch (error) {
      console.error('Failed to start MongoDB server:', error);
      throw error;
    }
  }, 120000);

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  it('/api/v1 (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1')
      .expect(200)
      .expect('Hello World!');
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  afterAll(async () => {
    if (mongoServer) {
      await mongoServer.stop();
    }
  });
});
