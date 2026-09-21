import { Module } from '@nestjs/common';
import { RabbitMqEventPublisher } from './infrastructure/rabbitmq-event-publisher.js';

@Module({
  providers: [
    RabbitMqEventPublisher,
    // Alias the string token to the SAME instance above (useExisting, not
    // another useClass) - two useClass registrations would each construct
    // their own RabbitMqEventPublisher, meaning two separate amqplib
    // connections opened by one logical service.
    {
      provide: 'EventPublisher',
      useExisting: RabbitMqEventPublisher,
    },
  ],
  exports: ['EventPublisher', RabbitMqEventPublisher],
})
export class SharedKernelModule {}
