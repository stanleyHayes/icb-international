import fastifyWebsocket from '@fastify/websocket';
import { chatClientFrameSchema, type ChatConversation, type ChatMessage, type ChatServerFrame } from '@icb/contracts';
import { forwardRef, Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { isDomainError } from '../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import {
  CHAT_WS_PATH,
  GUEST_NAME,
  WS_CLOSE_FORBIDDEN,
  WS_CLOSE_UNAUTHENTICATED,
  WS_READY_STATE_OPEN,
} from './chat.constants.js';
import { ChatService } from './application/chat.service.js';
import { ChatRealtimePort } from './application/chat-realtime.port.js';
import { ChatTokenService, type ChatWsTicketClaims } from './application/chat-token.service.js';

/**
 * The subset of the `ws` WebSocket the gateway relies on.
 *
 * Declared structurally rather than imported from `ws` (a transitive dependency pnpm does not
 * hoist), which also lets the unit tests drive the frame handler with a plain fake.
 */
export interface ChatSocket {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  on(event: 'message', listener: (data: { toString(): string }) => void): void;
  on(event: 'close' | 'error', listener: () => void): void;
}

/**
 * The live-chat WebSocket endpoint.
 *
 * Nest's global prefix applies to controllers only, so this route is registered directly on the
 * Fastify instance at the full `/v1/chat/ws` path, inside an encapsulated plugin context so
 * `@fastify/websocket` decorates nothing outside it. There is no guard pipeline here — the
 * upgrade is authenticated by the short-lived ws ticket in the query string, and the Origin
 * header (present on every browser upgrade) must be one of the configured CORS origins.
 *
 * Rooms are in-memory: one set of visitor sockets per conversation, one set for all staff. That
 * is deliberately single-process — horizontal scaling would move fan-out to Redis, and the room
 * maps are the only place that would change.
 */
@Injectable()
export class ChatGateway extends ChatRealtimePort implements OnModuleInit {
  private readonly visitors = new Map<string, Set<ChatSocket>>();
  private readonly staff = new Set<ChatSocket>();

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly chatTokens: ChatTokenService,
    @Inject(CONFIG) private readonly config: AppConfiguration,
    @Inject(forwardRef(() => ChatService))
    private readonly chat: ChatService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const fastify = this.adapterHost.httpAdapter.getInstance<FastifyInstance>();
    await fastify.register(async (scope) => {
      await scope.register(fastifyWebsocket);
      scope.get(CHAT_WS_PATH, { websocket: true }, (socket, request) => {
        void this.handleConnection(socket, request);
      });
    });
  }

  // ---- ChatRealtimePort ----------------------------------------------------

  conversationStarted(conversation: ChatConversation): void {
    this.broadcastToStaff({ type: 'conversation', conversation });
  }

  conversationClosed(conversationId: string, message: ChatMessage, conversation: ChatConversation): void {
    this.broadcastToConversation(conversationId, { type: 'message', message });
    this.broadcastToStaff({ type: 'conversation', conversation });
  }

  // ---- Connection lifecycle --------------------------------------------------

  private async handleConnection(socket: ChatSocket, request: FastifyRequest): Promise<void> {
    const claims = await this.authenticate(socket, request);
    if (!claims) {
      return;
    }

    this.joinRoom(socket, claims);
    this.sendFrame(socket, { type: 'ready', conversationId: claims.conversationId ?? null });

    socket.on('message', (data) => {
      void this.handleFrame(socket, claims, data.toString());
    });
    const leave = (): void => this.leaveRoom(socket, claims);
    socket.on('close', leave);
    socket.on('error', leave);
  }

  private async authenticate(
    socket: ChatSocket,
    request: FastifyRequest,
  ): Promise<ChatWsTicketClaims | null> {
    const { ticket } = request.query as { ticket?: unknown };
    if (typeof ticket !== 'string' || ticket.length === 0) {
      socket.close(WS_CLOSE_UNAUTHENTICATED, 'A ws ticket is required');
      return null;
    }

    let claims: ChatWsTicketClaims;
    try {
      claims = await this.chatTokens.verifyWsTicket(ticket);
    } catch {
      socket.close(WS_CLOSE_UNAUTHENTICATED, 'The ws ticket is invalid or expired');
      return null;
    }

    if (claims.role === 'visitor' && typeof claims.conversationId !== 'string') {
      socket.close(WS_CLOSE_UNAUTHENTICATED, 'The ws ticket is invalid or expired');
      return null;
    }

    // Non-browser clients (load tests, internal tools) send no Origin and are allowed;
    // a browser always sends one, and it must be an origin we already serve.
    const origin = request.headers.origin;
    if (origin !== undefined && !this.config.http.corsOrigins.includes(origin)) {
      socket.close(WS_CLOSE_FORBIDDEN, 'Origin not allowed');
      return null;
    }

    return claims;
  }

  // ---- Frame handling ---------------------------------------------------------

  /** Handles one raw client frame. Public so the unit tests can drive it with a fake socket. */
  async handleFrame(socket: ChatSocket, claims: ChatWsTicketClaims, raw: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      this.sendFrame(socket, { type: 'error', message: 'Invalid frame: not JSON' });
      return;
    }

    const frame = chatClientFrameSchema.safeParse(parsed);
    if (!frame.success) {
      this.sendFrame(socket, {
        type: 'error',
        message: 'Invalid frame: expected { type: "message", body } or { type: "ping" }',
      });
      return;
    }

    if (frame.data.type === 'ping') {
      this.sendFrame(socket, { type: 'pong' });
      return;
    }

    await this.handleMessageFrame(socket, claims, frame.data.body, frame.data.conversationId);
  }

  private async handleMessageFrame(
    socket: ChatSocket,
    claims: ChatWsTicketClaims,
    body: string,
    frameConversationId: string | undefined,
  ): Promise<void> {
    // A visitor's socket is bound to its conversation by the ticket; an agent must name theirs.
    const conversationId = claims.role === 'visitor' ? claims.conversationId : frameConversationId;
    if (!conversationId) {
      this.sendFrame(socket, { type: 'error', message: 'Agents must name the conversation' });
      return;
    }

    const authorName = claims.name ?? (claims.role === 'agent' ? 'Support' : GUEST_NAME);

    try {
      const { message, conversation } = await this.chat.postMessage(conversationId, {
        author: claims.role === 'agent' ? 'agent' : 'visitor',
        authorName,
        body,
      });
      this.broadcastToConversation(conversationId, { type: 'message', message });
      this.broadcastToStaff({ type: 'conversation', conversation });
    } catch (error) {
      this.sendFrame(socket, {
        type: 'error',
        message: isDomainError(error) ? error.message : 'The message could not be delivered',
      });
    }
  }

  // ---- Rooms -------------------------------------------------------------------

  private joinRoom(socket: ChatSocket, claims: ChatWsTicketClaims): void {
    if (claims.role === 'agent') {
      this.staff.add(socket);
      return;
    }
    const conversationId = claims.conversationId as string;
    let room = this.visitors.get(conversationId);
    if (!room) {
      room = new Set();
      this.visitors.set(conversationId, room);
    }
    room.add(socket);
  }

  private leaveRoom(socket: ChatSocket, claims: ChatWsTicketClaims): void {
    this.staff.delete(socket);
    if (claims.role === 'visitor' && claims.conversationId) {
      const room = this.visitors.get(claims.conversationId);
      if (room) {
        room.delete(socket);
        if (room.size === 0) {
          this.visitors.delete(claims.conversationId);
        }
      }
    }
  }

  /** A conversation's visitor sockets plus every staff socket. */
  private broadcastToConversation(conversationId: string, frame: ChatServerFrame): void {
    for (const socket of this.visitors.get(conversationId) ?? []) {
      this.sendFrame(socket, frame);
    }
    this.broadcastToStaff(frame);
  }

  private broadcastToStaff(frame: ChatServerFrame): void {
    for (const socket of this.staff) {
      this.sendFrame(socket, frame);
    }
  }

  private sendFrame(socket: ChatSocket, frame: ChatServerFrame): void {
    if (socket.readyState !== WS_READY_STATE_OPEN) {
      return;
    }
    try {
      socket.send(JSON.stringify(frame));
    } catch {
      // A socket that fails to send is about to close; the close handler cleans the room up.
    }
  }
}
