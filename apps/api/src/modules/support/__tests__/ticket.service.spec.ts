import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { TicketService } from '../application/ticket.service.js';
import { SatisfactionNotAllowedError, TicketClosedError } from '../domain/support-errors.js';
import type { SupportMessageDoc, SupportTicketDoc } from '../infrastructure/support.schemas.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');

function ticketDoc(overrides: Partial<SupportTicketDoc> = {}): SupportTicketDoc {
  return {
    _id: 't-1',
    reference: 'SUP-8F3K2M9Q',
    customerId: 'cus-1',
    customerName: 'Amara Mensah',
    subject: 'Card declined at checkout',
    category: 'card',
    priority: 'normal',
    status: 'open',
    assignedTo: null,
    assignedToName: null,
    messageCount: 1,
    lastMessageAt: NOW,
    slaDueAt: new Date('2026-08-03T12:00:00.000Z'),
    resolvedAt: null,
    closedAt: null,
    satisfaction: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function messageDoc(overrides: Partial<SupportMessageDoc> = {}): SupportMessageDoc {
  return {
    _id: 'm-1',
    ticketId: 't-1',
    customerId: 'cus-1',
    author: 'customer',
    authorId: 'cus-1',
    authorName: 'Amara Mensah',
    body: 'My card was declined',
    attachments: [],
    sentAt: NOW,
    ...overrides,
  };
}

function setup(options: { ticket?: SupportTicketDoc | null; customer?: Partial<CustomerDoc> | null } = {}) {
  const tickets = {
    find: vi.fn(() => ({ sort: vi.fn(() => ({ limit: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([ticketDoc()]) })) })) })),
    findOne: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(options.ticket === undefined ? ticketDoc() : options.ticket) })),
    findOneAndUpdate: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(ticketDoc({ status: 'resolved' })) })),
    create: vi.fn((docs: unknown[]) => Promise.resolve(docs)),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  };
  const messages = {
    find: vi.fn(() => ({ sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([messageDoc()]) })) })),
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
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new TicketService(
    tickets as unknown as Model<SupportTicketDoc>,
    messages as unknown as Model<SupportMessageDoc>,
    customers as unknown as Model<CustomerDoc>,
    clock,
  );
  return { service, tickets, messages, customers };
}

const CREATE_INPUT = { subject: 'Card declined at checkout', category: 'card' as const, body: 'My card was declined twice today', attachments: [] };

describe('TicketService.create', () => {
  it('opens the ticket with a reference, the default SLA and a first message', async () => {
    const { service, tickets, messages } = setup();

    const ticket = await service.create('cus-1', CREATE_INPUT);

    expect(ticket.reference).toMatch(/^SUP-/);
    expect(ticket.priority).toBe('normal');
    expect(ticket.status).toBe('open');
    expect(ticket.messageCount).toBe(1);
    expect(ticket.slaDueAt).toBe('2026-08-03T12:00:00.000Z');

    const createdDoc = tickets.create.mock.calls[0]?.[0]?.[0] as Record<string, unknown>;
    expect(createdDoc['customerName']).toBe('Amara Mensah');

    const firstMessage = messages.create.mock.calls[0]?.[0]?.[0] as Record<string, unknown>;
    expect(firstMessage['author']).toBe('customer');
    expect(firstMessage['body']).toBe(CREATE_INPUT.body);
    expect(firstMessage['sentAt']).toEqual(NOW);
  });

  it('refuses to open a ticket for a customer that does not exist', async () => {
    const { service } = setup({ customer: null });
    await expect(service.create('cus-x', CREATE_INPUT)).rejects.toThrow(NotFoundError);
  });
});

describe('TicketService.getForCustomer', () => {
  it('keeps ownership inside the query filter', async () => {
    const { service, tickets } = setup();

    await service.getForCustomer('cus-1', 't-1');

    expect(tickets.findOne).toHaveBeenCalledWith({ _id: 't-1', customerId: 'cus-1' });
  });

  it('answers not found when the ticket belongs to someone else', async () => {
    const { service } = setup({ ticket: null });
    await expect(service.getForCustomer('cus-2', 't-1')).rejects.toThrow(NotFoundError);
  });
});

describe('TicketService.reply', () => {
  it('appends the message and hands the ball to the agent', async () => {
    const { service, tickets } = setup();

    const message = await service.reply('cus-1', 't-1', { body: 'Any update?', attachments: [] });

    expect(message.author).toBe('customer');
    expect(tickets.updateOne).toHaveBeenCalledWith(
      { _id: 't-1' },
      {
        $inc: { messageCount: 1 },
        $set: { status: 'awaiting_agent', lastMessageAt: NOW, updatedAt: NOW },
      },
    );
  });

  it('rejects a reply on a closed ticket', async () => {
    const { service } = setup({ ticket: ticketDoc({ status: 'closed' }) });
    await expect(
      service.reply('cus-1', 't-1', { body: 'Hello?', attachments: [] }),
    ).rejects.toThrow(TicketClosedError);
  });
});

describe('TicketService.rateSatisfaction', () => {
  it('stores the rating through an atomic resolved-and-unrated filter', async () => {
    const { service, tickets } = setup();

    await service.rateSatisfaction('cus-1', 't-1', { rating: 5 });

    expect(tickets.findOneAndUpdate).toHaveBeenCalledWith(
      {
        _id: 't-1',
        customerId: 'cus-1',
        satisfaction: null,
        status: { $in: ['resolved', 'closed'] },
      },
      {
        $set: {
          satisfaction: { rating: 5, comment: null, ratedAt: NOW },
          updatedAt: NOW,
        },
      },
      { new: true },
    );
  });

  it('explains when the ticket is not resolved yet', async () => {
    const { service, tickets } = setup();
    tickets.findOneAndUpdate = vi.fn(() => ({ lean: vi.fn().mockResolvedValue(null) }));

    await expect(service.rateSatisfaction('cus-1', 't-1', { rating: 4 })).rejects.toThrow(
      SatisfactionNotAllowedError,
    );
  });

  it('explains when the ticket was already rated', async () => {
    const rated = ticketDoc({
      status: 'resolved',
      satisfaction: { rating: 5, comment: null, ratedAt: NOW },
    });
    const { service, tickets } = setup({ ticket: rated });
    tickets.findOneAndUpdate = vi.fn(() => ({ lean: vi.fn().mockResolvedValue(null) }));

    await expect(service.rateSatisfaction('cus-1', 't-1', { rating: 1 })).rejects.toThrow(
      SatisfactionNotAllowedError,
    );
  });
});
