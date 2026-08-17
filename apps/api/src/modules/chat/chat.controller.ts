import {
  startChatRequestSchema,
  type ChatHistoryResponse,
  type StartChatRequest,
  type StartChatResponse,
  type WsTicketResponse,
} from '@icb/contracts';
import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator.js';
import { DomainError } from '../../common/errors/domain.error.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { TokenService } from '../auth/application/token.service.js';
import { CHAT_WS_PATH, GUEST_NAME } from './chat.constants.js';
import { ChatService, type ChatAccessor } from './application/chat.service.js';
import { ChatTokenService, type ChatVisitorClaims } from './application/chat-token.service.js';

/** Mirrors the guard's bearer extraction; these routes verify their token by hand. */
function extractBearer(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
}

const UNAUTHENTICATED = (): DomainError =>
  new DomainError('UNAUTHENTICATED', 'A valid visitor or customer token is required');

/**
 * The visitor's side of live chat — anonymous marketing-site visitors and signed-in customers.
 *
 * These routes are `@Public()` because the primary audience holds no access token at all, only
 * the visitor token minted when the conversation started. Authentication therefore happens
 * inside the handlers: a request may carry a visitor token or a customer access token, and each
 * is verified explicitly (and pinned to its own audience) before any conversation is touched.
 */
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly chatTokens: ChatTokenService,
    private readonly accessTokens: TokenService,
  ) {}

  /**
   * Starts (or, for a signed-in customer, resumes) a conversation.
   *
   * The route is public so anonymous visitors can start a chat; when the request also carries a
   * valid customer access token the conversation is linked to that customer instead. There is no
   * optional-auth guard precedent in the codebase, so the header is parsed by hand: an absent or
   * invalid token simply means "anonymous", never an error.
   */
  @Public()
  @Post('conversations')
  start(
    @Body(zodBody(startChatRequestSchema.prefault({})))
    body: StartChatRequest,
    @Headers('authorization') authorization?: string,
  ): Promise<StartChatResponse> {
    return this.optionalCustomerId(authorization).then((customerId) =>
      this.chat.startConversation({ customerId, visitorName: body.visitorName }),
    );
  }

  /** The conversation and its history, for the visitor token or the owning customer. */
  @Public()
  @Get('conversations/:conversationId')
  async history(
    @Param('conversationId') conversationId: string,
    @Headers('authorization') authorization?: string,
  ): Promise<ChatHistoryResponse> {
    const accessor = await this.resolveAccessor(authorization);
    return this.chat.getHistory(conversationId, accessor);
  }

  /**
   * Mints the 120-second ticket the browser presents as a query parameter when upgrading to the
   * WebSocket — `new WebSocket()` cannot set headers. Either a visitor token (resuming its bound
   * conversation) or a customer access token (starting one if needed) is accepted.
   */
  @Public()
  @Post('ws-ticket')
  @HttpCode(HttpStatus.OK)
  async wsTicket(@Headers('authorization') authorization?: string): Promise<WsTicketResponse> {
    const token = extractBearer(authorization);
    if (!token) {
      throw UNAUTHENTICATED();
    }

    const visitor = await this.tryVisitorToken(token);
    if (visitor) {
      const conversation = await this.chat.getConversation(visitor.conversationId, {
        type: 'visitor',
        conversationId: visitor.conversationId,
      });
      return this.ticket({
        role: 'visitor',
        conversationId: conversation.id,
        name: conversation.visitorName ?? GUEST_NAME,
      });
    }

    let customerId: string | null;
    try {
      customerId = (await this.accessTokens.verifyAccessToken(token)).customerId;
    } catch {
      throw UNAUTHENTICATED();
    }
    if (!customerId) {
      throw new DomainError('FORBIDDEN', 'This endpoint is only available to customers');
    }

    const { conversation } = await this.chat.startConversation({ customerId });
    return this.ticket({
      role: 'visitor',
      conversationId: conversation.id,
      name: conversation.visitorName ?? GUEST_NAME,
    });
  }

  private async ticket(subject: Parameters<ChatTokenService['issueWsTicket']>[0]): Promise<WsTicketResponse> {
    return { ticket: await this.chatTokens.issueWsTicket(subject), wsPath: CHAT_WS_PATH };
  }

  private async resolveAccessor(authorization: string | undefined): Promise<ChatAccessor> {
    const token = extractBearer(authorization);
    if (!token) {
      throw UNAUTHENTICATED();
    }

    const visitor = await this.tryVisitorToken(token);
    if (visitor) {
      return { type: 'visitor', conversationId: visitor.conversationId };
    }

    try {
      const customerId = (await this.accessTokens.verifyAccessToken(token)).customerId;
      if (!customerId) {
        throw new DomainError('FORBIDDEN', 'This endpoint is only available to customers');
      }
      return { type: 'customer', customerId };
    } catch (error) {
      if (error instanceof DomainError) {
        throw error;
      }
      throw UNAUTHENTICATED();
    }
  }

  /** A valid visitor token's claims, or null when the bearer is some other credential. */
  private async tryVisitorToken(token: string): Promise<ChatVisitorClaims | null> {
    try {
      return await this.chatTokens.verifyVisitorToken(token);
    } catch {
      return null;
    }
  }

  /** The customer behind a valid access token, or null for anonymous/invalid requests. */
  private async optionalCustomerId(authorization: string | undefined): Promise<string | null> {
    const token = extractBearer(authorization);
    if (!token) {
      return null;
    }
    try {
      return (await this.accessTokens.verifyAccessToken(token)).customerId;
    } catch {
      return null;
    }
  }
}
