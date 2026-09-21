/**
 * Port: Event Publisher
 *
 * Defines the contract for publishing domain events to the event bus.
 * No framework imports - pure interface for dependency injection.
 *
 * Implementations may use RabbitMQ, Redis, Kafka, etc.
 */
export interface EventPublisher {
  /**
   * Publish an event to the message bus.
   *
   * @param routingKey - Topic routing key (e.g., "user.registered", "message.sent")
   * @param payload - Event payload (should include IDs and relevant fields, not full domain objects)
   * @returns Promise that resolves when the publish is complete
   *
   * Implementation note:
   * - Must never throw. Publish failures must be logged and returned gracefully.
   * - The triggering action (e.g., SendMessage) must always complete successfully,
   *   regardless of whether the event publish succeeds.
   */
  publish(routingKey: string, payload: unknown): Promise<void>;
}
