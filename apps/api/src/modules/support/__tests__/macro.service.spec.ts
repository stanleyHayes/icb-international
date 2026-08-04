import type { SupportMessage } from '@icb/contracts';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import { MacroService } from '../application/macro.service.js';
import { type InboxService } from '../application/inbox.service.js';
import type { SupportMacroDoc, SupportTicketDoc } from '../infrastructure/support.schemas.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');
const CREATED = new Date('2026-08-01T09:00:00.000Z');

const AGENT: AccessTokenClaims = {
  sub: 'st-9',
  customerId: null,
  email: 'agent@icb.example',
  roles: ['support'],
  sessionId: 'ses-1',
};

const MESSAGE: SupportMessage = {
  id: 'msg-1',
  ticketId: 't-1',
  author: 'agent',
  authorName: 'Sam Boateng',
  body: 'Hi Amara Mensah, re SUP-8F3K2M9Q — Sam Boateng.',
  attachments: [],
  sentAt: NOW.toISOString(),
};

function macroDoc(overrides: Partial<SupportMacroDoc> = {}): SupportMacroDoc {
  return {
    _id: 'mac-1',
    name: 'Card replacement',
    category: 'card',
    body: 'Hi {{customerName}}, re {{ticketReference}} — {{agentName}}.',
    usageCount: 3,
    createdBy: 'st-1',
    createdAt: CREATED,
    updatedAt: NOW,
    ...overrides,
  };
}

function ticketStub(): SupportTicketDoc {
  return {
    customerName: 'Amara Mensah',
    reference: 'SUP-8F3K2M9Q',
  } as unknown as SupportTicketDoc;
}

function setup(
  options: {
    rows?: SupportMacroDoc[];
    createError?: unknown;
    updateResult?: SupportMacroDoc | null;
    updateError?: unknown;
    deletedCount?: number;
    macro?: SupportMacroDoc | null;
  } = {},
) {
  const updated =
    options.updateResult === undefined ? macroDoc({ name: 'Renamed' }) : options.updateResult;
  const macros = {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(options.rows ?? [macroDoc()]) })),
    })),
    create: options.createError
      ? vi.fn().mockRejectedValue(options.createError)
      : vi.fn((docs: unknown[]) => Promise.resolve(docs)),
    findOneAndUpdate: vi.fn(() => ({
      lean: options.updateError
        ? vi.fn().mockRejectedValue(options.updateError)
        : vi.fn().mockResolvedValue(updated),
    })),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: options.deletedCount ?? 1 }),
    findById: vi.fn(() => ({
      lean: vi.fn().mockResolvedValue(options.macro === undefined ? macroDoc() : options.macro),
    })),
    updateOne: vi.fn().mockResolvedValue({ acknowledged: true }),
  };
  const inbox = {
    loadTicket: vi.fn().mockResolvedValue(ticketStub()),
    displayNameFor: vi.fn().mockResolvedValue('Sam Boateng'),
    reply: vi.fn().mockResolvedValue(MESSAGE),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new MacroService(
    macros as unknown as Model<SupportMacroDoc>,
    inbox as unknown as InboxService,
    clock,
  );
  return { service, macros, inbox };
}

describe('MacroService.list', () => {
  it('returns macros ordered by category then name', async () => {
    const { service, macros } = setup({
      rows: [macroDoc(), macroDoc({ _id: 'mac-2', name: 'Fee dispute', category: 'fees' })],
    });

    const views = await service.list();

    expect(macros.find).toHaveBeenCalledWith();
    expect(views).toHaveLength(2);
    expect(views[0]).toMatchObject({ id: 'mac-1', usageCount: 3, createdBy: 'st-1' });
    expect(views[0]?.createdAt).toBe(CREATED.toISOString());
  });
});

describe('MacroService.create', () => {
  it('persists the macro stamped with the caller and the simulation clock', async () => {
    const { service, macros } = setup();

    const view = await service.create(AGENT, {
      name: 'Card replacement',
      category: 'card',
      body: 'Hi {{customerName}}',
    });

    const sent = macros.create.mock.calls[0]?.[0]?.[0] as Record<string, unknown>;
    expect(sent).toMatchObject({
      name: 'Card replacement',
      category: 'card',
      usageCount: 0,
      createdBy: 'st-9',
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(view.usageCount).toBe(0);
    expect(view.createdBy).toBe('st-9');
  });

  it('maps a duplicate name to a conflict', async () => {
    const { service } = setup({
      createError: Object.assign(new Error('dup'), { code: 11000 }),
    });

    await expect(
      service.create(AGENT, { name: 'Card replacement', category: 'card', body: 'x' }),
    ).rejects.toThrow(ConflictError);
  });

  it('rethrows persistence errors that are not duplicate keys', async () => {
    const failure = new Error('connection lost');
    const { service } = setup({ createError: failure });

    await expect(
      service.create(AGENT, { name: 'Card replacement', category: 'card', body: 'x' }),
    ).rejects.toBe(failure);
  });
});

describe('MacroService.update', () => {
  function lastSet(macros: { findOneAndUpdate: ReturnType<typeof vi.fn> }): Record<string, unknown> {
    const call = macros.findOneAndUpdate.mock.calls[0] as unknown[];
    const update = call[1] as { $set: Record<string, unknown> };
    return update.$set;
  }

  it('sets only the fields present in the request plus updatedAt', async () => {
    const { service, macros } = setup();

    const view = await service.update('mac-1', { name: 'Renamed' });

    const set = lastSet(macros);
    expect(set['name']).toBe('Renamed');
    expect(set['updatedAt']).toEqual(NOW);
    expect(set).not.toHaveProperty('category');
    expect(set).not.toHaveProperty('body');
    expect(view.name).toBe('Renamed');
  });

  it('updates every field when all are given', async () => {
    const { service, macros } = setup();

    await service.update('mac-1', { name: 'N', category: 'fees', body: 'B' });

    expect(lastSet(macros)).toEqual({ name: 'N', category: 'fees', body: 'B', updatedAt: NOW });
  });

  it('rejects an unknown macro id', async () => {
    const { service } = setup({ updateResult: null });

    await expect(service.update('mac-x', { name: 'Renamed' })).rejects.toThrow(NotFoundError);
  });

  it('maps a duplicate name to a conflict', async () => {
    const { service } = setup({
      updateError: Object.assign(new Error('dup'), { code: 11000 }),
    });

    await expect(service.update('mac-1', { name: 'Taken' })).rejects.toThrow(ConflictError);
  });
});

describe('MacroService.remove', () => {
  it('deletes the macro', async () => {
    const { service, macros } = setup();

    await service.remove('mac-1');

    expect(macros.deleteOne).toHaveBeenCalledWith({ _id: 'mac-1' });
  });

  it('rejects an unknown macro id', async () => {
    const { service } = setup({ deletedCount: 0 });

    await expect(service.remove('mac-x')).rejects.toThrow(NotFoundError);
  });
});

describe('MacroService.apply', () => {
  it('renders against the ticket, posts as the agent, and counts the use', async () => {
    const { service, macros, inbox } = setup();

    const message = await service.apply('mac-1', 't-1', AGENT);

    expect(inbox.reply).toHaveBeenCalledWith('t-1', AGENT, {
      body: 'Hi Amara Mensah, re SUP-8F3K2M9Q — Sam Boateng.',
      attachments: [],
      resolve: false,
    });
    expect(macros.updateOne).toHaveBeenCalledWith({ _id: 'mac-1' }, { $inc: { usageCount: 1 } });
    expect(message).toBe(MESSAGE);
  });

  it('rejects an unknown macro id before touching the ticket', async () => {
    const { service, inbox } = setup({ macro: null });

    await expect(service.apply('mac-x', 't-1', AGENT)).rejects.toThrow(NotFoundError);
    expect(inbox.loadTicket).not.toHaveBeenCalled();
  });
});
