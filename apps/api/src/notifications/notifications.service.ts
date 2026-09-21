import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import amqplib, { type ChannelModel, type Channel, type ConsumeMessage } from 'amqplib';
import { ConfigService } from '../config/config.service.js';

interface RoutingKeyBinding {
  routingKey: string;
  queue: string;
}

const EXCHANGE_NAME = 'chat.events';

const BINDINGS: RoutingKeyBinding[] = [
  { routingKey: 'user.registered', queue: 'notifications.user.registered' },
  { routingKey: 'message.sent', queue: 'notifications.message.sent' },
  { routingKey: 'conversation.created', queue: 'notifications.conversation.created' },
  { routingKey: 'member.added', queue: 'notifications.member.added' },
  { routingKey: 'user.online', queue: 'notifications.user.online' },
  { routingKey: 'user.offline', queue: 'notifications.user.offline' },
];

/**
 * Notifications Service - Event Consumer Stub
 *
 * Currently a logging-only stub that receives events from the chat.events
 * exchange. Future implementations can add email, push notifications, etc.
 *
 * Built directly on `amqplib` (see rabbitmq-event-publisher.ts for why:
 * `@golevelup/nestjs-rabbitmq` requires NestJS v11, incompatible with this
 * project's v12).
 *
 * Idempotency note:
 * - Since this stub only logs events, it is trivially idempotent -
 *   logging the same event twice changes no state.
 * - A real consumer that sends emails or writes to a database would need
 *   an idempotency key check (e.g. store processed event/message ids) and
 *   idempotent operations (upserts, not inserts) - not needed here yet.
 */
@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    try {
      this.connection = await amqplib.connect(this.configService.rabbitmqUrl);
      this.channel = await this.connection.createChannel();
      await this.channel.assertExchange(EXCHANGE_NAME, 'topic', { durable: true });

      for (const binding of BINDINGS) {
        await this.channel.assertQueue(binding.queue, { durable: true });
        await this.channel.bindQueue(binding.queue, EXCHANGE_NAME, binding.routingKey);
        await this.channel.consume(binding.queue, (msg) =>
          this.handleMessage(binding.routingKey, msg),
        );
      }

      this.logger.debug(
        `Subscribed to ${BINDINGS.length} routing keys on ${EXCHANGE_NAME}`,
      );
    } catch (error) {
      this.logger.error('Failed to start notifications consumer:', error);
      // Don't throw - the app must still start even if the broker is down.
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

  private handleMessage(routingKey: string, msg: ConsumeMessage | null): void {
    if (!msg) return;
    try {
      const payload = JSON.parse(msg.content.toString('utf-8'));
      this.logger.log(`Received ${routingKey} event: ${JSON.stringify(payload)}`);
      // TODO: dispatch to real notification channels (email/push/etc.)
    } catch (error) {
      this.logger.error(`Failed to process ${routingKey} event:`, error);
    } finally {
      this.channel?.ack(msg);
    }
  }
}
