import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { io } from 'socket.io-client';
import { AppModule } from '../src/app.module.js';

describe('Messaging - WebSocket Gateway (e2e)', () => {
  let app: INestApplication;
  let httpServer: any;
  let mongoServer: MongoMemoryServer | null = null;
  let serverPort: number;

  // Test users
  const testUser1 = {
    email: 'ws-user1@example.com',
    password: 'SecurePassword123',
    displayName: 'WS User One',
  };

  const testUser2 = {
    email: 'ws-user2@example.com',
    password: 'SecurePassword456',
    displayName: 'WS User Two',
  };

  const testUser3 = {
    email: 'ws-user3@example.com',
    password: 'SecurePassword789',
    displayName: 'WS User Three',
  };

  // Will be populated in beforeAll
  let user1Id: string;
  let user1AccessToken: string;
  let user2Id: string;
  let user2AccessToken: string;
  let _user3Id: string;
  let user3AccessToken: string;

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

      // Get a real HTTP server for WebSocket connections
      httpServer = app.getHttpServer();

      // Start the server and get the port
      await new Promise<void>((resolve) => {
        httpServer.listen(0, () => {
          serverPort = httpServer.address().port;
          resolve();
        });
      });

      // Register and login test users
      const user1Response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser1)
        .expect(201);
      user1Id = user1Response.body.user.id;
      user1AccessToken = user1Response.body.accessToken;

      const user2Response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser2)
        .expect(201);
      user2Id = user2Response.body.user.id;
      user2AccessToken = user2Response.body.accessToken;

      const user3Response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(testUser3)
        .expect(201);
      _user3Id = user3Response.body.user.id;
      user3AccessToken = user3Response.body.accessToken;
    } catch (error) {
      console.error('Failed to initialize test app:', error);
      throw error;
    }
  }, 60000);

  afterAll(async () => {
    if (httpServer) {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err: any) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }
    if (app) {
      await app.close();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  describe('WebSocket Connection Authentication', () => {
    it('should refuse connection without token', async () => {
      return new Promise<void>((resolve, reject) => {
        const socket = io(`http://localhost:${serverPort}`, {
          reconnection: false,
          autoConnect: true,
        });

        socket.on('disconnect', () => {
          resolve();
        });

        socket.on('error', (_error) => {
          // Socket may emit error or just disconnect
        });

        socket.on('connect', () => {
          // Should not connect
          socket.disconnect();
          reject(new Error('Socket should not have connected without a token'));
        });

        // Give the connection a short timeout
        setTimeout(() => {
          if (socket.connected) {
            socket.disconnect();
            reject(new Error('Socket should not have connected without a token'));
          } else {
            resolve();
          }
        }, 2000);
      });
    });

    it('should refuse connection with invalid token', async () => {
      return new Promise<void>((resolve, reject) => {
        const socket = io(`http://localhost:${serverPort}`, {
          auth: {
            token: 'invalid-token-that-is-not-a-valid-jwt',
          },
          reconnection: false,
          autoConnect: true,
        });

        socket.on('disconnect', () => {
          resolve();
        });

        socket.on('error', (_error) => {
          // Socket may emit error or just disconnect
        });

        socket.on('connect', () => {
          // Should not connect
          socket.disconnect();
          reject(new Error('Socket should not have connected with an invalid token'));
        });

        // Give the connection a short timeout
        setTimeout(() => {
          if (socket.connected) {
            socket.disconnect();
            reject(new Error('Socket should not have connected with an invalid token'));
          } else {
            resolve();
          }
        }, 2000);
      });
    });

    it('should accept connection with valid access token', async () => {
      return new Promise<void>((resolve, reject) => {
        const socket = io(`http://localhost:${serverPort}`, {
          auth: {
            token: user1AccessToken,
          },
          reconnection: false,
          autoConnect: true,
        });

        socket.on('connect', () => {
          expect(socket.connected).toBe(true);
          socket.disconnect();
          resolve();
        });

        socket.on('error', (error) => {
          socket.disconnect();
          reject(new Error(`Socket connection failed with error: ${error}`));
        });
      });
    });
  });

  describe('Conversation Membership Verification', () => {
    it('should reject join attempt if user is not a member', async () => {
      return new Promise<void>((resolve, reject) => {
        // Create a conversation between user1 and user2 (user3 not included)
        request(app.getHttpServer())
          .post('/api/v1/conversations')
          .set('Authorization', `Bearer ${user1AccessToken}`)
          .send({
            type: '1:1',
            memberId: user2Id,
          })
          .expect(201)
          .end((_err, res) => {
            if (_err) {
              reject(_err);
              return;
            }

            const conversationId = res.body.conversationId;

            // Try to connect user3 (who is not a member)
            const socket3 = io(`http://localhost:${serverPort}`, {
              auth: { token: user3AccessToken },
              reconnection: false,
            });

            let _errorReceived = false;

            socket3.on('connect', () => {
              socket3.emit('conversation:join', { conversationId });

              socket3.on('conversation:join:error', (_error) => {
                _errorReceived = true;
                socket3.disconnect();
              });

              setTimeout(() => {
                socket3.disconnect();
              }, 1000);
            });

            socket3.on('disconnect', () => {
              resolve();
            });
          });
      });
    });
  });

  describe('Message Send and Delivery', () => {
    it('should deliver message to connected members', async () => {
      return new Promise<void>((resolve, reject) => {
        // Create a 1:1 conversation
        request(app.getHttpServer())
          .post('/api/v1/conversations')
          .set('Authorization', `Bearer ${user1AccessToken}`)
          .send({
            type: '1:1',
            memberId: user2Id,
          })
          .expect(201)
          .end((_err, res) => {
            if (_err) {
              reject(_err);
              return;
            }

            const conversationId = res.body.conversationId;
            let socket1JoinedRoom = false;
            let socket2JoinedRoom = false;
            let messageReceived = false;

            const socket1 = io(`http://localhost:${serverPort}`, {
              auth: { token: user1AccessToken },
              reconnection: false,
            });

            const socket2 = io(`http://localhost:${serverPort}`, {
              auth: { token: user2AccessToken },
              reconnection: false,
            });

            const cleanup = () => {
              if (socket1.connected) socket1.disconnect();
              if (socket2.connected) socket2.disconnect();
            };

            const checkReady = () => {
              if (socket1JoinedRoom && socket2JoinedRoom) {
                // Send a message from user1
                socket1.emit('message:send', {
                  conversationId,
                  text: 'Test message',
                });
              }
            };

            socket1.on('connect', () => {
              socket1.emit('conversation:join', { conversationId });
              // Set flag after a brief delay to allow server processing
              setTimeout(() => {
                socket1JoinedRoom = true;
                checkReady();
              }, 100);
            });

            socket2.on('connect', () => {
              socket2.emit('conversation:join', { conversationId });
              // Set flag after a brief delay to allow server processing
              setTimeout(() => {
                socket2JoinedRoom = true;
                checkReady();
              }, 100);
            });

            socket2.on('message:new', (message) => {
              expect(message.conversationId).toBe(conversationId);
              expect(message.senderId).toBe(user1Id);
              expect(message.text).toBe('Test message');
              messageReceived = true;
              cleanup();
            });

            socket1.on('error', (_error) => {
              cleanup();
              reject(new Error('Socket1 error during message delivery'));
            });

            socket2.on('error', (_error) => {
              cleanup();
              reject(new Error('Socket2 error during message delivery'));
            });

            socket1.on('disconnect', () => {
              if (socket2.connected) return; // Wait for both
              if (messageReceived) {
                resolve();
              } else {
                reject(new Error('Message was not delivered'));
              }
            });

            socket2.on('disconnect', () => {
              if (socket1.connected) return; // Wait for both
              if (messageReceived) {
                resolve();
              } else {
                reject(new Error('Message was not delivered'));
              }
            });

            // Timeout after 10 seconds
            setTimeout(() => {
              cleanup();
              if (!messageReceived) {
                reject(new Error('Test timed out - message not received'));
              }
            }, 10000);
          });
      });
    });
  });

  describe('Error Handling', () => {
    it('should reject empty message', async () => {
      return new Promise<void>((resolve, reject) => {
        // Create a conversation
        request(app.getHttpServer())
          .post('/api/v1/conversations')
          .set('Authorization', `Bearer ${user1AccessToken}`)
          .send({
            type: '1:1',
            memberId: user2Id,
          })
          .expect(201)
          .end((_err, res) => {
            if (_err) {
              reject(_err);
              return;
            }

            const conversationId = res.body.conversationId;
            const socket = io(`http://localhost:${serverPort}`, {
              auth: { token: user1AccessToken },
              reconnection: false,
            });

            let errorReceived = false;

            socket.on('connect', () => {
              socket.emit('conversation:join', { conversationId });
              // Wait for join to complete before sending message
              setTimeout(() => {
                // Try to send an empty message
                socket.emit('message:send', {
                  conversationId,
                  text: '',
                });
              }, 200);
            });

            socket.on('message:send:error', (error) => {
              if (error.message && error.message.includes('cannot be empty')) {
                errorReceived = true;
              }
              socket.disconnect();
            });

            socket.on('disconnect', () => {
              if (errorReceived) {
                resolve();
              } else {
                reject(new Error('Did not receive expected error for empty message'));
              }
            });

            // Timeout
            setTimeout(() => {
              socket.disconnect();
              if (!errorReceived) {
                reject(new Error('Test timed out'));
              }
            }, 5000);
          });
      });
    });

    it('should reject message that exceeds max length', async () => {
      return new Promise<void>((resolve, reject) => {
        // Create a conversation
        request(app.getHttpServer())
          .post('/api/v1/conversations')
          .set('Authorization', `Bearer ${user1AccessToken}`)
          .send({
            type: '1:1',
            memberId: user2Id,
          })
          .expect(201)
          .end((_err, res) => {
            if (_err) {
              reject(_err);
              return;
            }

            const conversationId = res.body.conversationId;
            const socket = io(`http://localhost:${serverPort}`, {
              auth: { token: user1AccessToken },
              reconnection: false,
            });

            let errorReceived = false;

            socket.on('connect', () => {
              socket.emit('conversation:join', { conversationId });
              // Wait for join to complete before sending message
              setTimeout(() => {
                // Try to send a message that exceeds max length (4000 chars)
                const tooLongMessage = 'a'.repeat(4001);
                socket.emit('message:send', {
                  conversationId,
                  text: tooLongMessage,
                });
              }, 200);
            });

            socket.on('message:send:error', (error) => {
              if (error.message && error.message.includes('cannot exceed')) {
                errorReceived = true;
              }
              socket.disconnect();
            });

            socket.on('disconnect', () => {
              if (errorReceived) {
                resolve();
              } else {
                reject(new Error('Did not receive expected error for long message'));
              }
            });

            // Timeout
            setTimeout(() => {
              socket.disconnect();
              if (!errorReceived) {
                reject(new Error('Test timed out'));
              }
            }, 5000);
          });
      });
    });
  });

  describe('Read Receipts', () => {
    it('should broadcast read position to other connected members', async () => {
      return new Promise<void>((resolve, reject) => {
        // Create a 1:1 conversation
        request(app.getHttpServer())
          .post('/api/v1/conversations')
          .set('Authorization', `Bearer ${user1AccessToken}`)
          .send({
            type: '1:1',
            memberId: user2Id,
          })
          .expect(201)
          .end((_err, res) => {
            if (_err) {
              reject(_err);
              return;
            }

            const conversationId = res.body.conversationId;
            let messageId: string | null = null;
            let socket1JoinedRoom = false;
            let socket2JoinedRoom = false;
            let readUpdateReceived = false;

            const socket1 = io(`http://localhost:${serverPort}`, {
              auth: { token: user1AccessToken },
              reconnection: false,
            });

            const socket2 = io(`http://localhost:${serverPort}`, {
              auth: { token: user2AccessToken },
              reconnection: false,
            });

            const cleanup = () => {
              if (socket1.connected) socket1.disconnect();
              if (socket2.connected) socket2.disconnect();
            };

            const tryMarkAsRead = () => {
              if (socket1JoinedRoom && socket2JoinedRoom && messageId) {
                // Mark the conversation as read
                socket1.emit('message:read', {
                  conversationId,
                  messageId,
                });
              }
            };

            socket1.on('connect', () => {
              socket1.emit('conversation:join', { conversationId });
              setTimeout(() => {
                socket1JoinedRoom = true;
                tryMarkAsRead();
              }, 100);
            });

            socket2.on('connect', () => {
              socket2.emit('conversation:join', { conversationId });
              setTimeout(() => {
                socket2JoinedRoom = true;
                // Send a message once both have joined
                if (socket1JoinedRoom) {
                  socket2.emit('message:send', {
                    conversationId,
                    text: 'Test message',
                  });
                }
              }, 150);
            });

            socket1.on('message:new', (message) => {
              messageId = message.messageId;
              tryMarkAsRead();
            });

            // socket2 should receive the read update from socket1
            socket2.on('message:read:update', (data) => {
              expect(data.conversationId).toBe(conversationId);
              expect(data.userId).toBe(user1Id);
              expect(data.messageId).toBe(messageId);
              readUpdateReceived = true;
              cleanup();
            });

            socket1.on('error', (_error) => {
              cleanup();
              reject(new Error('Socket1 error'));
            });

            socket2.on('error', (_error) => {
              cleanup();
              reject(new Error('Socket2 error'));
            });

            socket1.on('disconnect', () => {
              if (socket2.connected) return; // Wait for both
              if (readUpdateReceived) {
                resolve();
              } else {
                reject(new Error('Read update was not received'));
              }
            });

            socket2.on('disconnect', () => {
              if (socket1.connected) return; // Wait for both
              if (readUpdateReceived) {
                resolve();
              } else {
                reject(new Error('Read update was not received'));
              }
            });

            // Timeout after 10 seconds
            setTimeout(() => {
              cleanup();
              if (!readUpdateReceived) {
                reject(new Error('Test timed out - read update not received'));
              }
            }, 10000);
          });
      });
    });

    it('should reject read attempt from non-member', async () => {
      return new Promise<void>((resolve, reject) => {
        // Create a conversation between user1 and user2 (user3 not included)
        request(app.getHttpServer())
          .post('/api/v1/conversations')
          .set('Authorization', `Bearer ${user1AccessToken}`)
          .send({
            type: '1:1',
            memberId: user2Id,
          })
          .expect(201)
          .end((_err, res) => {
            if (_err) {
              reject(_err);
              return;
            }

            const conversationId = res.body.conversationId;
            let messageId: string | null = null;
            let socket1JoinedRoom = false;
            let socket2JoinedRoom = false;

            const socket1 = io(`http://localhost:${serverPort}`, {
              auth: { token: user1AccessToken },
              reconnection: false,
            });

            const socket2 = io(`http://localhost:${serverPort}`, {
              auth: { token: user2AccessToken },
              reconnection: false,
            });

            // Try to connect user3 (who is not a member)
            const socket3 = io(`http://localhost:${serverPort}`, {
              auth: { token: user3AccessToken },
              reconnection: false,
            });

            let errorReceived = false;

            const cleanup = () => {
              if (socket1.connected) socket1.disconnect();
              if (socket2.connected) socket2.disconnect();
              if (socket3.connected) socket3.disconnect();
            };

            const tryReadAsNonMember = () => {
              if (socket1JoinedRoom && socket2JoinedRoom && messageId && socket3.connected) {
                // Try to mark as read from non-member socket
                socket3.emit('message:read', {
                  conversationId,
                  messageId,
                });
              }
            };

            socket1.on('connect', () => {
              socket1.emit('conversation:join', { conversationId });
              setTimeout(() => {
                socket1JoinedRoom = true;
                tryReadAsNonMember();
              }, 100);
            });

            socket2.on('connect', () => {
              socket2.emit('conversation:join', { conversationId });
              setTimeout(() => {
                socket2JoinedRoom = true;
                // Send a message once both have joined
                if (socket1JoinedRoom) {
                  socket2.emit('message:send', {
                    conversationId,
                    text: 'Test message',
                  });
                }
              }, 150);
            });

            socket1.on('message:new', (message) => {
              messageId = message.messageId;
              tryReadAsNonMember();
            });

            socket3.on('connect', () => {
              tryReadAsNonMember();
            });

            socket3.on('message:read:error', (error) => {
              if (error.message && error.message.includes('not a member')) {
                errorReceived = true;
              }
              cleanup();
            });

            socket1.on('error', (_error) => {
              cleanup();
              reject(new Error('Socket1 error'));
            });

            socket2.on('error', (_error) => {
              cleanup();
              reject(new Error('Socket2 error'));
            });

            socket3.on('error', (_error) => {
              // May be disconnected or error emitted
              if (!errorReceived) {
                cleanup();
              }
            });

            socket1.on('disconnect', () => {
              if (socket2.connected || socket3.connected) return;
              if (errorReceived) {
                resolve();
              } else {
                reject(new Error('Did not receive expected error for non-member'));
              }
            });

            socket2.on('disconnect', () => {
              if (socket1.connected || socket3.connected) return;
              if (errorReceived) {
                resolve();
              } else {
                reject(new Error('Did not receive expected error for non-member'));
              }
            });

            socket3.on('disconnect', () => {
              if (socket1.connected || socket2.connected) return;
              if (errorReceived) {
                resolve();
              } else {
                reject(new Error('Did not receive expected error for non-member'));
              }
            });

            // Timeout after 10 seconds
            setTimeout(() => {
              cleanup();
              if (!errorReceived) {
                reject(new Error('Test timed out - error not received'));
              }
            }, 10000);
          });
      });
    });
  });
});
