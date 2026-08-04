import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import type { StaffUserDoc } from '../../iam/infrastructure/iam.schemas.js';
import { InboxService } from '../application/inbox.service.js';
import type { SupportMessageDoc, SupportTicketDoc } from '../infrastructure/support.schemas.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const CREATED = new Date('2026-08-01T09:00:00.000Z');

const AGENT: AccessTokenClaims = {
  sub: 'st-9',
  customerId: null,
  email: 'agent@icb.example',
  roles: ['support'],
  sessionId: 'ses-1',
};

function staffDoc(overrides: Partial<StaffUserDoc> = {}): StaffUserDoc {
  return {
    _id: 'st-1',
    email: 'sam@icb.example',
    firstName: 'Sam',
    lastName: 'Boateng',
    roles: ['support'],
    active: true,
    ...overrides,
  } as StaffUserDoc;
}

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
    slaDueAt: new Date('2026-08-02T09:00:00.000Z'),
    resolvedAt: null,
    closedAt: null,
    satisfaction: null,
    createdAt: CREATED,
    updatedAt: NOW,
    ...overrides,
  };
}

function setup(options: {
  staff?: StaffUserDoc | null;
  agents?: StaffUserDoc[];
  workloads?: { _id: string; openTickets: number }[];
  ticket?: SupportTicketDoc | null;
} = {}) {
  const updated = ticketDoc({ status: 'resolved', assignedTo: 'st-2', assignedToName: 'Efya Owusu' });
  const tickets = {
    findById: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(options.ticket === undefined ? ticketDoc() : options.ticket) })),
    findOneAndUpdate: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(updated) })),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
    aggregate: vi.fn().mockResolvedValue(options.workloads ?? []),
  };
  const messages = {
    create: vi.fn((docs: unknown[]) => Promise.resolve(docs)),
  };
  const staffUsers = {
    findById: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(options.staff === undefined ? staffDoc() : options.staff) })),
    find: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(options.agents ?? [staffDoc()]) })),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new InboxService(
    tickets as unknown as Model<SupportTicketDoc>,
    messages as unknown as Model<SupportMessageDoc>,
    staffUsers as unknown as Model<StaffUserDoc>,
    clock,
  );
  return { service, tickets, messages, staffUsers };
}

describe('InboxService.assign', () => {
  it('assigns to the named agent with their display name denormalised', async () => {
    const { service, tickets } = setup();

    await service.assign('t-1', 'st-1', AGENT);

    expect(tickets.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 't-1' },
      { $set: { assignedTo: 'st-1', assignedToName: 'Sam Boateng', updatedAt: NOW } },
      { new: true },
    );
  });

  it('assigns to the caller when no staff id is given', async () => {
    const { service, staffUsers } = setup({ staff: staffDoc({ _id: 'st-9' }) });

    await service.assign('t-1', undefined, AGENT);

    expect(staffUsers.findById).toHaveBeenCalledWith('st-9');
  });

  it('refuses to assign to a staff member that does not exist', async () => {
    const { service } = setup({ staff: null });
    await expect(service.assign('t-1', 'st-x', AGENT)).rejects.toThrow(NotFoundError);
  });
});

describe('InboxService.autoAssign', () => {
  it('routes to the least-loaded active support agent', async () => {
    const agents = [
      staffDoc({ _id: 'st-1' }),
      staffDoc({ _id: 'st-2', firstName: 'Efya', lastName: 'Owusu' }),
    ];
    const { service, tickets } = setup({ agents, workloads: [{ _id: 'st-1', openTickets: 4 }] });

    await service.autoAssign('t-1');

    expect(tickets.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 't-1' },
      { $set: { assignedTo: 'st-2', assignedToName: 'Efya Owusu', updatedAt: NOW } },
      { new: true },
    );
  });

  it('only considers active staff holding the support role', async () => {
    const { service, staffUsers } = setup();

    await service.autoAssign('t-1');

    expect(staffUsers.find).toHaveBeenCalledWith({ active: true, roles: 'support' });
  });

  it('fails cleanly when nobody is available', async () => {
    const { service } = setup({ agents: [] });
    await expect(service.autoAssign('t-1')).rejects.toThrow(ConflictError);
  });
});

describe('InboxService.update', () => {
  function lastUpdate(tickets: { findOneAndUpdate: ReturnType<typeof vi.fn> }): {
    $set: Record<string, unknown>;
  } {
    const call = tickets.findOneAndUpdate.mock.calls[0] as unknown[];
    return call[1] as { $set: Record<string, unknown> };
  }

  it('recomputes the SLA from the original filing time when priority changes', async () => {
    const { service, tickets } = setup();

    await service.update('t-1', { priority: 'high' });

    const update = lastUpdate(tickets);
    expect(update.$set['priority']).toBe('high');
    // high = 8 hours from filing at 2026-08-01T09:00Z, not from now.
    expect(update.$set['slaDueAt']).toEqual(new Date('2026-08-01T17:00:00.000Z'));
  });

  it('stamps resolvedAt when the ticket is resolved', async () => {
    const { service, tickets } = setup();

    await service.update('t-1', { status: 'resolved' });

    const update = lastUpdate(tickets);
    expect(update.$set['status']).toBe('resolved');
    expect(update.$set['resolvedAt']).toEqual(NOW);
  });
});

describe('InboxService.reply', () => {
  it('posts as the agent and moves the ticket to awaiting_customer', async () => {
    const { service, tickets, messages } = setup();

    const message = await service.reply('t-1', AGENT, { body: 'Looking into it.', attachments: [], resolve: false });

    expect(message.author).toBe('agent');
    const sent = messages.create.mock.calls[0]?.[0]?.[0] as Record<string, unknown>;
    expect(sent['authorName']).toBe('Sam Boateng');
    expect(tickets.updateOne).toHaveBeenCalledWith(
      { _id: 't-1' },
      { $inc: { messageCount: 1 }, $set: { status: 'awaiting_customer', lastMessageAt: NOW, updatedAt: NOW } },
    );
  });

  it('reply-and-resolve stamps resolvedAt in the same update', async () => {
    const { service, tickets } = setup();

    await service.reply('t-1', AGENT, { body: 'Fixed.', attachments: [], resolve: true });

    expect(tickets.updateOne).toHaveBeenCalledWith(
      { _id: 't-1' },
      { $inc: { messageCount: 1 }, $set: { status: 'resolved', lastMessageAt: NOW, updatedAt: NOW, resolvedAt: NOW } },
    );
  });
});
