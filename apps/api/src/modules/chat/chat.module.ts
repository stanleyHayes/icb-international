import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';

import { CustomerDoc, CustomerSchema } from '../customers/infrastructure/customer.schemas.js';
import { ChatGateway } from './chat.gateway.js';
import { ChatStaffController } from './chat-staff.controller.js';
import { ChatController } from './chat.controller.js';
import { ChatRealtimePort } from './application/chat-realtime.port.js';
import { ChatTokenService } from './application/chat-token.service.js';
import { ChatService } from './application/chat.service.js';
import {
  ChatConversationDoc,
  ChatConversationSchema,
  ChatMessageDoc,
  ChatMessageSchema,
} from './infrastructure/chat.schemas.js';

/**
 * Live support chat over WebSockets.
 *
 * Three audiences: anonymous marketing-site visitors (visitor token only), authenticated
 * customers (access token links the conversation), and the role-gated support desk. The
 * customer side matches `@icb/contracts` exactly; the WebSocket itself lives at
 * `/v1/chat/ws`, registered on the Fastify instance by `ChatGateway` because the global
 * prefix applies to controllers only.
 *
 * `CustomerDoc` is registered read-only: a customer's display name is denormalised onto the
 * conversation at creation. `JwtModule` mirrors the auth module's bare registration — signing
 * secrets are passed per call, so the module needs only to provide `JwtService`.
 */
@Module({
  imports: [
    JwtModule.register({}),
    MongooseModule.forFeature([
      { name: ChatConversationDoc.name, schema: ChatConversationSchema },
      { name: ChatMessageDoc.name, schema: ChatMessageSchema },
      { name: CustomerDoc.name, schema: CustomerSchema },
    ]),
  ],
  controllers: [ChatController, ChatStaffController],
  providers: [
    ChatService,
    ChatTokenService,
    ChatGateway,
    { provide: ChatRealtimePort, useExisting: ChatGateway },
  ],
  exports: [ChatService],
})
export class ChatModule {}
