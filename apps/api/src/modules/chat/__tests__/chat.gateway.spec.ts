import type { ChatConversation, ChatMessage, ChatServerFrame } from '@icb/contracts';
import type { Mock } from 'vitest';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError } from '../../../common/errors/index.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import type { ChatService } from '../application/chat.service.js';
import type { ChatWsTicketClaims } from '../application/chat-token.service.js';
import { ChatGateway, type ChatSocket } from '../chat.gateway.js';

const MESSAGE: ChatMessage = {
  id: 'msg-1',
  conversationId: 'conv-1',
  author: 'visitor',
  authorName: 'Amara',
  body: 'Hi',
  sentAt: '2026-08-02T12:00:00.000Z',
};

const CONVERSATION: ChatConversation = {
  id: 'conv-1',
  status: 'open',
  customerId: null,
  visitorName: 'Amara',
  lastMessagePreview: 'Hi',
  lastMessageAt: '2026-08-02T12:00:00.000Z',
  createdAt: '2026-08-02T11:00:00.000Z',
  closedAt: null,
};

const VISITOR: ChatWsTicketClaims = {
  typ: 'chat_ws',
  role: 'visitor',
  conversationId: 'conv-1',
  name: 'Amara',
};

const AGENT: ChatWsTicketClaims = {
  typ: 'chat_ws',
  role: 'agent',
  sub: 'staff-1',
  name: 'agent@icb.bank',
};

interface FakeSocket extends ChatSocket {
  send: Mock;
  close: Mock;
  on: Mock;
}

function fakeSocket(): FakeSocket {
  return { readyState: 1, send: vi.fn(), close: vi.fn(), on: vi.fn() };
}

function framesSent(socket: FakeSocket): ChatServerFrame[] {
  return socket.send.mock.calls.map(([data]) => JSON.parse(data as string) as ChatServerFrame);
}

function setup() {
  const chat = {
    postMessage: vi.fn().mockResolvedValue({ message: MESSAGE, conversation: CONVERSATION }),
  };
  const gateway = new ChatGateway(
    // The adapter host and token service are only touched by onModuleInit / handleConnection,
    // which these frame-handling tests never reach.
    {} as never,
    {} as never,
    { http: { corsOrigins: ['https://app.icb.example'] } } as unknown as AppConfiguration,
    chat as unknown as ChatService,
  );
  return { gateway, chat };
}

/** Joins rooms the way handleConnection would, without standing up a socket. */
function join(
  gateway: ChatGateway,
  socket: FakeSocket,
  claims: ChatWsTicketClaims,
): void {
  (gateway as unknown as { joinRoom(s: ChatSocket, c: ChatWsTicketClaims): void }).joinRoom(
    socket,
    claims,
  );
}

describe('ChatGateway frame validation', () => {
  it('replies with an error frame to invalid JSON', async () => {
    const { gateway } = setup();
    const socket = fakeSocket();

    await gateway.handleFrame(socket, VISITOR, '{not json');

    expect(framesSent(socket)).toEqual([
      { type: 'error', message: 'Invalid frame: not JSON' },
    ]);
  });

  it('replies with an error frame to a frame the schema rejects', async () => {
    const { gateway } = setup();
    const socket = fakeSocket();

    await gateway.handleFrame(socket, VISITOR, JSON.stringify({ type: 'nope' }));

    const [frame] = framesSent(socket);
    expect(frame?.type).toBe('error');
  });

  it('rejects an over-long message without persisting it', async () => {
    const { gateway, chat } = setup();
    const socket = fakeSocket();

    await gateway.handleFrame(
      socket,
      VISITOR,
      JSON.stringify({ type: 'message', body: 'x'.repeat(2001) }),
    );

    const [frame] = framesSent(socket);
    expect(frame?.type).toBe('error');
    expect(chat.postMessage).not.toHaveBeenCalled();
  });

  it('answers a ping with a pong', async () => {
    const { gateway } = setup();
    const socket = fakeSocket();

    await gateway.handleFrame(socket, VISITOR, JSON.stringify({ type: 'ping' }));

    expect(framesSent(socket)).toEqual([{ type: 'pong' }]);
  });
});

describe('ChatGateway message routing', () => {
  it('persists a visitor message and broadcasts it to the conversation room and staff', async () => {
    const { gateway, chat } = setup();
    const visitorSocket = fakeSocket();
    const staffSocket = fakeSocket();
    join(gateway, visitorSocket, VISITOR);
    join(gateway, staffSocket, AGENT);

    await gateway.handleFrame(
      visitorSocket,
      VISITOR,
      JSON.stringify({ type: 'message', body: 'Hi' }),
    );

    expect(chat.postMessage).toHaveBeenCalledWith('conv-1', {
      author: 'visitor',
      authorName: 'Amara',
      body: 'Hi',
    });

    expect(framesSent(visitorSocket)).toEqual([{ type: 'message', message: MESSAGE }]);
    expect(framesSent(staffSocket)).toEqual([
      { type: 'message', message: MESSAGE },
      { type: 'conversation', conversation: CONVERSATION },
    ]);
  });

  it('does not leak a message to another conversation’s room', async () => {
    const { gateway } = setup();
    const visitorSocket = fakeSocket();
    const otherVisitor = fakeSocket();
    join(gateway, visitorSocket, VISITOR);
    join(gateway, otherVisitor, { ...VISITOR, conversationId: 'conv-2' });

    await gateway.handleFrame(
      visitorSocket,
      VISITOR,
      JSON.stringify({ type: 'message', body: 'Hi' }),
    );

    expect(framesSent(otherVisitor)).toEqual([]);
  });

  it('requires an agent frame to name the conversation', async () => {
    const { gateway, chat } = setup();
    const agentSocket = fakeSocket();

    await gateway.handleFrame(
      agentSocket,
      AGENT,
      JSON.stringify({ type: 'message', body: 'How can I help?' }),
    );

    const [frame] = framesSent(agentSocket);
    expect(frame).toEqual({ type: 'error', message: 'Agents must name the conversation' });
    expect(chat.postMessage).not.toHaveBeenCalled();
  });

  it('posts an agent reply under the staff name from the ticket', async () => {
    const { gateway, chat } = setup();
    const agentSocket = fakeSocket();
    const visitorSocket = fakeSocket();
    // The client frame schema validates conversationId as a ULID, unlike the visitor path,
    // where the id comes from the ticket rather than the frame.
    const conversationId = '01J0ZK3Q1M2N4P5R6S7T8V9W0X';
    join(gateway, agentSocket, AGENT);
    join(gateway, visitorSocket, { ...VISITOR, conversationId });

    await gateway.handleFrame(
      agentSocket,
      AGENT,
      JSON.stringify({ type: 'message', body: 'How can I help?', conversationId }),
    );

    expect(chat.postMessage).toHaveBeenCalledWith(conversationId, {
      author: 'agent',
      authorName: 'agent@icb.bank',
      body: 'How can I help?',
    });
    expect(framesSent(visitorSocket)).toEqual([{ type: 'message', message: MESSAGE }]);
  });

  it('turns a closed-conversation rejection into an error frame', async () => {
    const { gateway, chat } = setup();
    chat.postMessage.mockRejectedValue(new ConflictError('This conversation is closed'));
    const socket = fakeSocket();

    await gateway.handleFrame(socket, VISITOR, JSON.stringify({ type: 'message', body: 'Hi' }));

    expect(framesSent(socket)).toEqual([
      { type: 'error', message: 'This conversation is closed' },
    ]);
  });
});
