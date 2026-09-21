import { describe, it, expect, vi } from 'vitest';
import { RabbitMqEventPublisher } from './rabbitmq-event-publisher.js';
import type { ConfigService } from '../../config/config.service.js';

// Covers specs/platform/event-bus/spec.md's "Event publication failure
// does not fail the triggering action" requirement at the one place that
// requirement's guarantee actually lives: the adapter itself never
// rejects, regardless of broker state. Use-case specs (e.g.
// register-user.use-case.spec.ts) correctly don't defend against a
// misbehaving publisher - they trust this contract - so it has to be
// verified here, not there.

const fakeConfig = { rabbitmqUrl: 'amqp://unused:unused@localhost:1' } as ConfigService;

describe('RabbitMqEventPublisher', () => {
  it('resolves without throwing when the broker was never reachable (channel never initialized)', async () => {
    const publisher = new RabbitMqEventPublisher(fakeConfig);
    // Deliberately not calling onModuleInit() - simulates a broker that
    // was unreachable at startup, leaving the internal channel null.

    await expect(
      publisher.publish('user.registered', { userId: 'u1' }),
    ).resolves.toBeUndefined();
  });

  it('resolves without throwing when the underlying channel.publish call itself throws', async () => {
    const publisher = new RabbitMqEventPublisher(fakeConfig);

    // Inject a fake channel whose publish() throws, simulating a broker
    // that accepted the connection but rejects/fails the actual publish
    // (e.g. connection dropped mid-flight).
    const brokenChannel = {
      publish: vi.fn(() => {
        throw new Error('channel closed');
      }),
    };
    (publisher as unknown as { channel: unknown }).channel = brokenChannel;

    await expect(
      publisher.publish('message.sent', { messageId: 'm1' }),
    ).resolves.toBeUndefined();
    expect(brokenChannel.publish).toHaveBeenCalledOnce();
  });
});
