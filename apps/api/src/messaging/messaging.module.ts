import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Domain & Application
import {
  CreateOneToOneConversation,
  CreateGroupConversation,
  AddMemberToConversation,
  ListConversations,
  SendMessage,
  GetMessageHistory,
  MarkConversationRead,
} from './application/index.js';

// Infrastructure - Persistence
import { ConversationSchema as ConversationSchemaFactory } from './infrastructure/persistence/conversation.schema.js';
import { MembershipSchema as MembershipSchemaFactory } from './infrastructure/persistence/membership.schema.js';
import { MessageSchema as MessageSchemaFactory } from './infrastructure/persistence/message.schema.js';
import { MongooseConversationRepository } from './infrastructure/persistence/mongoose-conversation.repository.js';
import { MongooseMessageRepository } from './infrastructure/persistence/mongoose-message.repository.js';
import { MongooseMembershipRepository } from './infrastructure/persistence/mongoose-membership.repository.js';

// Infrastructure - HTTP
import { ConversationsController } from './infrastructure/http/conversations.controller.js';
import { MessagesController } from './infrastructure/http/messages.controller.js';

// Infrastructure - WebSocket
import { MessagingGateway } from './infrastructure/gateway/messaging.gateway.js';

// Other modules
import { IdentityModule } from '../identity/identity.module.js';
import { PresenceModule } from '../presence/presence.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Conversation', schema: ConversationSchemaFactory },
      { name: 'Membership', schema: MembershipSchemaFactory },
      { name: 'Message', schema: MessageSchemaFactory },
    ]),
    IdentityModule,
    PresenceModule,
  ],
  controllers: [ConversationsController, MessagesController],
  providers: [
    // Repositories
    MongooseConversationRepository,
    MongooseMessageRepository,
    MongooseMembershipRepository,

    // Use Cases
    {
      provide: CreateOneToOneConversation,
      useFactory: (conversationRepo: MongooseConversationRepository) =>
        new CreateOneToOneConversation(conversationRepo),
      inject: [MongooseConversationRepository],
    },
    {
      provide: CreateGroupConversation,
      useFactory: (conversationRepo: MongooseConversationRepository) =>
        new CreateGroupConversation(conversationRepo),
      inject: [MongooseConversationRepository],
    },
    {
      provide: AddMemberToConversation,
      useFactory: (conversationRepo: MongooseConversationRepository) =>
        new AddMemberToConversation(conversationRepo),
      inject: [MongooseConversationRepository],
    },
    {
      provide: ListConversations,
      useFactory: (conversationRepo: MongooseConversationRepository) =>
        new ListConversations(conversationRepo),
      inject: [MongooseConversationRepository],
    },
    {
      provide: SendMessage,
      useFactory: (conversationRepo: MongooseConversationRepository, messageRepo: MongooseMessageRepository) =>
        new SendMessage(conversationRepo, messageRepo),
      inject: [MongooseConversationRepository, MongooseMessageRepository],
    },
    {
      provide: GetMessageHistory,
      useFactory: (conversationRepo: MongooseConversationRepository, messageRepo: MongooseMessageRepository) =>
        new GetMessageHistory(conversationRepo, messageRepo),
      inject: [MongooseConversationRepository, MongooseMessageRepository],
    },
    {
      provide: MarkConversationRead,
      useFactory: (
        conversationRepo: MongooseConversationRepository,
        messageRepo: MongooseMessageRepository,
        membershipRepo: MongooseMembershipRepository,
      ) => new MarkConversationRead(conversationRepo, messageRepo, membershipRepo),
      inject: [MongooseConversationRepository, MongooseMessageRepository, MongooseMembershipRepository],
    },

    // WebSocket Gateway
    MessagingGateway,
  ],
  exports: [
    // Export repositories for other modules
    MongooseConversationRepository,
    MongooseMessageRepository,
    MongooseMembershipRepository,
    // Export use cases
    CreateOneToOneConversation,
    CreateGroupConversation,
    AddMemberToConversation,
    ListConversations,
    SendMessage,
    GetMessageHistory,
    MarkConversationRead,
  ],
})
export class MessagingModule {}
