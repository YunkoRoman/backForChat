import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import amqplib, { type ChannelModel, type Channel } from 'amqplib';
import { EventPublisher } from '../event-publisher.interface.js';
import { ConfigService } from '../../config/config.service.js';

/**
 * RabbitMQ adapter for EventPublisher, built directly on `amqplib`.
 *
 * `@golevelup/nestjs-rabbitmq` was tried first (per design.md) but every
 * published version pins a peer dependency on `@nestjs/core@^11`, which
 * conflicts with this project's NestJS v12 and broke e2e test module
 * resolution entirely. Talking to amqplib directly has no such
 * NestJS-version coupling.
 *
 * Resilience strategy:
 * - Catches all publish failures internally and logs them
 * - NEVER throws from publish() - always resolves
 * - This allows the triggering action (e.g., SendMessage) to always
 *   succeed, even if the event bus is temporarily unavailable
 */
@Injectable()
export class RabbitMqEventPublisher
  implements EventPublisher, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RabbitMqEventPublisher.name);
  private readonly exchangeName = 'chat.events';

  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    try {
      this.connection = await amqplib.connect(this.configService.rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(this.exchangeName, 'topic', {
        durable: true,
      });
      this.connection.on('error', (error) => {
        this.logger.error('RabbitMQ connection error:', error);
      });
      this.logger.debug(`Connected and declared exchange: ${this.exchangeName}`);
    } catch (error) {
      this.logger.error('Failed to connect to RabbitMQ on startup:', error);
      // Don't throw - the app must still start even if the broker is down;
      // publish() below tolerates connection/channel being null.
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.channel?.close();
      await this.connection?.close();
    } catch (error) {
      this.logger.warn('Error closing RabbitMQ connection:', error);
    }
  }

  /**
   * Publish an event to the message bus.
   *
   * If publishing fails (or the broker was never reachable), logs the
   * error and returns normally. This ensures the triggering action always
   * succeeds regardless of event bus availability.
   */
  async publish(routingKey: string, payload: unknown): Promise<void> {
    try {
      if (!this.channel) {
        throw new Error('RabbitMQ channel is not available');
      }
      this.channel.publish(
        this.exchangeName,
        routingKey,
        Buffer.from(JSON.stringify(payload)),
        { persistent: true, contentType: 'application/json' },
      );
      this.logger.debug(`Event published: ${routingKey}`);
    } catch (error) {
      this.logger.error(`Failed to publish event "${routingKey}":`, error);
    }
  }
}
