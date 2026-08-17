import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import type { ChatTokenService } from '../application/chat-token.service.js';
import { ChatService } from '../application/chat.service.js';
import type { ChatConversationDoc, ChatMessageDoc } from '../infrastructure/chat.schemas.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');

function conversationDoc(overrides: Partial<ChatConversationDoc> = {}): ChatConversationDoc {
  return {
    _id: 'conv-1',
    customerId: 'cus-1',
    visitorName: 'Amara Mensah',
    status: 'open',
    assignedTo: null,
    lastMessagePreview: null,
    lastMessageAt: null,
    createdAt: NOW,
    closedAt: null,
    ...overrides,
  };
}

function messageDoc(overrides: Partial<ChatMessageDoc> = {}): ChatMessageDoc {
  return {
    _id: 'msg-1',
    conversationId: 'conv-1',
    author: 'visitor',
    authorName: 'Amara Mensah',
    body: 'Hello, I need help',
    sentAt: NOW,
    ...overrides,
  };
}

interface SetupOptions {
  /** What `findOne(...).sort().lean()` resolves — the customer's existing open conversation. */
  existing?: ChatConversationDoc | null;
  /** What `findOne(...).lean()` resolves — the conversation loaded by id. */
  conversation?: ChatConversationDoc | null;
  messages?: ChatMessageDoc[];
  inbox?: ChatConversationDoc[];
  customer?: Partial<CustomerDoc> | null;
}

function setup(options: SetupOptions = {}) {
  const conversations = {
    findOne: vi.fn(() => ({
      sort: vi.fn(() => ({
        lean: vi.fn().mockResolvedValue(options.existing ?? null),
      })),
      lean: vi
        .fn()
        .mockResolvedValue(
          options.conversation === undefined ? conversationDoc() : options.conversation,
        ),
    })),
    find: vi.fn(() => ({
      sort: vi.fn(() => ({
        limit: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(options.inbox ?? []) })),
      })),
    })),
    create: vi.fn((docs: unknown[]) => Promise.resolve(docs)),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  };
  const messages = {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(options.messages ?? []) })),
    })),
    create: vi.fn((docs: unknown[]) => Promise.resolve(docs)),
  };
  const customers = {
    findById: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue(
        options.customer === undefined
          ? {
              type: 'individual',
              individual: { firstName: 'Amara', lastName: 'Mensah' },
              business: null,
              email: 'amara@example.com',
            }
          : options.customer,
      ),
    })),
  };
  const chatTokens = {
    issueVisitorToken: vi.fn().mockResolvedValue('visitor-token'),
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const realtime = {
    conversationStarted: vi.fn(),
    conversationClosed: vi.fn(),
  };

  const service = new ChatService(
    conversations as unknown as Model<ChatConversationDoc>,
    messages as unknown as Model<ChatMessageDoc>,
    customers as unknown as Model<CustomerDoc>,
    chatTokens as unknown as ChatTokenService,
    clock,
    realtime,
  );
  return { service, conversations, messages, customers, chatTokens, realtime };
}

describe('ChatService.startConversation', () => {
  it('creates a new conversation for an anonymous visitor and announces it to staff', async () => {
    const { service, conversations, chatTokens, realtime } = setup();

    const result = await service.startConversation({ visitorName: 'Kofi' });

    const createdDoc = conversations.create.mock.calls[0]?.[0]?.[0] as Record<string, unknown>;
    expect(createdDoc['customerId']).toBeNull();
    expect(createdDoc['visitorName']).toBe('Kofi');
    expect(createdDoc['status']).toBe('open');
    expect(createdDoc['createdAt']).toEqual(NOW);

    expect(result.conversation.status).toBe('open');
    expect(result.visitorToken).toBe('visitor-token');
    expect(result.messages).toEqual([]);
    expect(chatTokens.issueVisitorToken).toHaveBeenCalledWith(result.conversation.id);
    expect(realtime.conversationStarted).toHaveBeenCalledWith(result.conversation);
  });

  it('links a customer conversation and names it from the customer record', async () => {
    const { service, conversations } = setup({ existing: null });

    const result = await service.startConversation({ customerId: 'cus-1' });

    const createdDoc = conversations.create.mock.calls[0]?.[0]?.[0] as Record<string, unknown>;
    expect(createdDoc['customerId']).toBe('cus-1');
    expect(createdDoc['visitorName']).toBe('Amara Mensah');
    expect(result.conversation.customerId).toBe('cus-1');
  });

  it('reuses the customer’s existing open conversation instead of creating a second', async () => {
    const existing = conversationDoc({ lastMessageAt: NOW, lastMessagePreview: 'Earlier' });
    const { service, conversations, realtime } = setup({
      existing,
      messages: [messageDoc()],
    });

    const result = await service.startConversation({ customerId: 'cus-1' });

    expect(conversations.create).not.toHaveBeenCalled();
    expect(result.conversation.id).toBe('conv-1');
    expect(result.messages).toHaveLength(1);
    expect(result.visitorToken).toBe('visitor-token');
    expect(realtime.conversationStarted).not.toHaveBeenCalled();
  });

  it('refuses to start a customer conversation for a customer that does not exist', async () => {
    const { service } = setup({ existing: null, customer: null });
    await expect(service.startConversation({ customerId: 'cus-x' })).rejects.toThrow(
      NotFoundError,
    );
  });
});

describe('ChatService.getHistory', () => {
  it('returns the conversation and its history to the owning customer', async () => {
    const { service } = setup({ messages: [messageDoc()] });

    const history = await service.getHistory('conv-1', { type: 'customer', customerId: 'cus-1' });

    expect(history.conversation.id).toBe('conv-1');
    expect(history.messages).toHaveLength(1);
    expect(history.messages[0]?.sentAt).toBe('2026-08-02T12:00:00.000Z');
  });

  it('lets the bound visitor token read its own conversation', async () => {
    const { service } = setup({ conversation: conversationDoc({ customerId: null }) });

    const history = await service.getHistory('conv-1', {
      type: 'visitor',
      conversationId: 'conv-1',
    });

    expect(history.conversation.id).toBe('conv-1');
  });

  it('rejects a visitor token bound to a different conversation', async () => {
    const { service } = setup();

    await expect(
      service.getHistory('conv-1', { type: 'visitor', conversationId: 'conv-other' }),
    ).rejects.toThrow(ForbiddenError);
  });

  it('hides another customer’s conversation behind not-found', async () => {
    const { service } = setup();

    await expect(
      service.getHistory('conv-1', { type: 'customer', customerId: 'cus-2' }),
    ).rejects.toThrow(NotFoundError);
  });

  it('lets staff read any conversation', async () => {
    const { service } = setup();

    const history = await service.getHistory('conv-1', { type: 'staff' });

    expect(history.conversation.id).toBe('conv-1');
  });

  it('throws not-found for a conversation that does not exist', async () => {
    const { service } = setup({ conversation: null });

    await expect(service.getHistory('conv-x', { type: 'staff' })).rejects.toThrow(NotFoundError);
  });
});

describe('ChatService.postMessage', () => {
  it('persists the message and folds it into the conversation inbox row', async () => {
    const { service, conversations, messages } = setup();

    const { message, conversation } = await service.postMessage('conv-1', {
      author: 'visitor',
      authorName: 'Amara Mensah',
      body: 'My card was declined',
    });

    const createdMessage = messages.create.mock.calls[0]?.[0]?.[0] as Record<string, unknown>;
    expect(createdMessage['author']).toBe('visitor');
    expect(createdMessage['body']).toBe('My card was declined');
    expect(createdMessage['sentAt']).toEqual(NOW);

    expect(conversations.updateOne).toHaveBeenCalledWith(
      { _id: 'conv-1' },
      { $set: { lastMessagePreview: 'My card was declined', lastMessageAt: NOW } },
    );
    expect(message.body).toBe('My card was declined');
    expect(conversation.lastMessagePreview).toBe('My card was declined');
    expect(conversation.lastMessageAt).toBe('2026-08-02T12:00:00.000Z');
  });

  it('truncates the stored preview, not the message', async () => {
    const { service } = setup();
    const long = 'x'.repeat(500);

    const { message, conversation } = await service.postMessage('conv-1', {
      author: 'visitor',
      authorName: 'Amara Mensah',
      body: long,
    });

    expect(message.body).toHaveLength(500);
    expect(conversation.lastMessagePreview).toHaveLength(140);
  });

  it('rejects a message on a closed conversation', async () => {
    const { service, messages } = setup({ conversation: conversationDoc({ status: 'closed' }) });

    await expect(
      service.postMessage('conv-1', { author: 'visitor', authorName: 'Amara', body: 'still there?' }),
    ).rejects.toThrow(ConflictError);
    expect(messages.create).not.toHaveBeenCalled();
  });
});

describe('ChatService.staffInbox', () => {
  it('lists open conversations most recently active first', async () => {
    const inbox = [
      conversationDoc({ _id: 'conv-recent', lastMessageAt: new Date('2026-08-02T12:00:00.000Z') }),
      conversationDoc({ _id: 'conv-older', lastMessageAt: new Date('2026-08-01T09:00:00.000Z') }),
    ];
    const { service, conversations } = setup({ inbox });

    const result = await service.staffInbox();

    expect(conversations.find).toHaveBeenCalledWith({ status: 'open' });
    expect(result.conversations.map((c) => c.id)).toEqual(['conv-recent', 'conv-older']);
  });
});

describe('ChatService.closeConversation', () => {
  it('closes the conversation, records who closed it, and posts a system message', async () => {
    const { service, conversations, messages, realtime } = setup();

    const closed = await service.closeConversation('conv-1', 'staff-1');

    expect(conversations.updateOne).toHaveBeenCalledWith(
      { _id: 'conv-1' },
      { $set: { status: 'closed', closedAt: NOW, assignedTo: 'staff-1' } },
    );

    const systemMessage = messages.create.mock.calls[0]?.[0]?.[0] as Record<string, unknown>;
    expect(systemMessage['author']).toBe('system');
    expect(systemMessage['body']).toBe('Chat closed');
    expect(systemMessage['sentAt']).toEqual(NOW);

    expect(closed.status).toBe('closed');
    expect(closed.closedAt).toBe('2026-08-02T12:00:00.000Z');
    expect(realtime.conversationClosed).toHaveBeenCalledWith(
      'conv-1',
      expect.objectContaining({ author: 'system', body: 'Chat closed' }),
      closed,
    );
  });

  it('rejects closing an already-closed conversation', async () => {
    const { service } = setup({ conversation: conversationDoc({ status: 'closed' }) });

    await expect(service.closeConversation('conv-1', 'staff-1')).rejects.toThrow(ConflictError);
  });

  it('throws not-found for a conversation that does not exist', async () => {
    const { service } = setup({ conversation: null });

    await expect(service.closeConversation('conv-x', 'staff-1')).rejects.toThrow(NotFoundError);
  });
});
