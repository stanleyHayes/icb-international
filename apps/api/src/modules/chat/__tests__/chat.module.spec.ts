import { HttpAdapterHost } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import { describe, expect, it, vi } from 'vitest';

import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { TokenService } from '../../auth/application/token.service.js';
import { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { ChatRealtimePort } from '../application/chat-realtime.port.js';
import { ChatTokenService } from '../application/chat-token.service.js';
import { ChatService } from '../application/chat.service.js';
import { ChatStaffController } from '../chat-staff.controller.js';
import { ChatController } from '../chat.controller.js';
import { ChatGateway } from '../chat.gateway.js';
import { ChatConversationDoc, ChatMessageDoc } from '../infrastructure/chat.schemas.js';

/**
 * The gateway and the service depend on each other (the gateway persists frames through the
 * service; the service announces lifecycle events through the gateway's realtime port), so the
 * module only boots if the forwardRef cycle resolves. This spec mirrors ChatModule's wiring —
 * with the database models, the global config/clock, and the Fastify instance stubbed — and
 * proves Nest can construct and initialise the graph.
 */
describe('ChatModule wiring', () => {
  it('resolves the service ↔ gateway cycle and runs onModuleInit', async () => {
    const fastify = { register: vi.fn().mockResolvedValue(undefined) };
    const config = {
      http: { corsOrigins: [] },
      jwt: { accessSecret: 'test-secret' },
    } as unknown as AppConfiguration;

    const moduleRef = await Test.createTestingModule({
      imports: [JwtModule.register({})],
      controllers: [ChatController, ChatStaffController],
      providers: [
        ChatService,
        ChatTokenService,
        ChatGateway,
        { provide: ChatRealtimePort, useExisting: ChatGateway },
        { provide: getModelToken(ChatConversationDoc.name), useValue: {} },
        { provide: getModelToken(ChatMessageDoc.name), useValue: {} },
        { provide: getModelToken(CustomerDoc.name), useValue: {} },
        { provide: TokenService, useValue: {} },
        { provide: CONFIG, useValue: config },
        { provide: ClockService, useValue: new ClockService() },
        {
          provide: HttpAdapterHost,
          useValue: { httpAdapter: { getInstance: () => fastify } },
        },
      ],
    }).compile();

    await moduleRef.init();

    expect(moduleRef.get(ChatService)).toBeInstanceOf(ChatService);
    const gateway = moduleRef.get(ChatGateway);
    expect(gateway).toBeInstanceOf(ChatGateway);
    expect(moduleRef.get(ChatRealtimePort)).toBe(gateway);
    expect(fastify.register).toHaveBeenCalled();

    await moduleRef.close();
  });
});
