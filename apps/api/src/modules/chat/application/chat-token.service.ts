import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import {
  CHAT_VISITOR_AUDIENCE,
  CHAT_WS_AUDIENCE,
  VISITOR_TOKEN_TTL_SECONDS,
  WS_TICKET_TTL_SECONDS,
} from '../chat.constants.js';

/** The resume credential an anonymous visitor holds; bound to exactly one conversation. */
export interface ChatVisitorClaims {
  readonly typ: 'chat_visitor';
  readonly conversationId: string;
}

/** Who is upgrading to the WebSocket: a visitor bound to a conversation, or an agent. */
export interface ChatWsTicketClaims {
  readonly typ: 'chat_ws';
  readonly role: 'visitor' | 'agent';
  readonly conversationId?: string;
  readonly sub?: string;
  readonly name?: string;
}

export type ChatWsTicketSubject = Omit<ChatWsTicketClaims, 'typ'>;

/**
 * Chat-scoped tokens.
 *
 * Both kinds are signed with the access-token secret but pinned to their own audiences, so a
 * chat token can never be replayed as an access token (or vice versa). The visitor token is
 * long-lived — it is the visitor's only credential for resuming a conversation — while the ws
 * ticket is minted on demand and expires in two minutes because it travels in the WebSocket
 * query string (browsers cannot set `Authorization` on `new WebSocket()`).
 */
@Injectable()
export class ChatTokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(CONFIG) private readonly config: AppConfiguration,
  ) {}

  issueVisitorToken(conversationId: string): Promise<string> {
    return this.jwt.signAsync(
      { typ: 'chat_visitor', conversationId } satisfies ChatVisitorClaims,
      {
        secret: this.config.jwt.accessSecret,
        issuer: 'icb',
        audience: CHAT_VISITOR_AUDIENCE,
        expiresIn: VISITOR_TOKEN_TTL_SECONDS,
      },
    );
  }

  verifyVisitorToken(token: string): Promise<ChatVisitorClaims> {
    return this.jwt.verifyAsync<ChatVisitorClaims>(token, {
      secret: this.config.jwt.accessSecret,
      issuer: 'icb',
      audience: CHAT_VISITOR_AUDIENCE,
    });
  }

  issueWsTicket(subject: ChatWsTicketSubject): Promise<string> {
    return this.jwt.signAsync(
      { ...subject, typ: 'chat_ws' } satisfies ChatWsTicketClaims,
      {
        secret: this.config.jwt.accessSecret,
        issuer: 'icb',
        audience: CHAT_WS_AUDIENCE,
        expiresIn: WS_TICKET_TTL_SECONDS,
      },
    );
  }

  verifyWsTicket(token: string): Promise<ChatWsTicketClaims> {
    return this.jwt.verifyAsync<ChatWsTicketClaims>(token, {
      secret: this.config.jwt.accessSecret,
      issuer: 'icb',
      audience: CHAT_WS_AUDIENCE,
    });
  }
}
