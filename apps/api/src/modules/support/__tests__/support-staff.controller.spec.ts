import type { SupportMessage } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import { type CallbackService } from '../application/callback.service.js';
import { type InboxService } from '../application/inbox.service.js';
import { type MacroService } from '../application/macro.service.js';
import type { CallbackView, MacroView, StaffTicketView } from '../infrastructure/support-requests.js';
import { SupportStaffController } from '../support-staff.controller.js';

const STAFF = {
  sub: 'staff-1',
  customerId: null,
  email: 'sam@icb.example',
  roles: ['support_agent'],
  sessionId: 'session-9',
} as AccessTokenClaims;

const TICKET_VIEW = { id: 'ticket-1', status: 'open' } as unknown as StaffTicketView;
const MESSAGE = { id: 'msg-1', body: 'staff reply' } as unknown as SupportMessage;
const MACRO = { id: 'macro-1', name: 'greeting' } as unknown as MacroView;
const CALLBACK = { id: 'cb-1', status: 'pending' } as unknown as CallbackView;

describe('SupportStaffController', () => {
  let inbox: Record<string, ReturnType<typeof vi.fn>>;
  let macros: Record<string, ReturnType<typeof vi.fn>>;
  let callbacks: {
    listForStaff: ReturnType<typeof vi.fn>;
    complete: ReturnType<typeof vi.fn>;
    cancel: ReturnType<typeof vi.fn>;
  };
  let controller: SupportStaffController;

  beforeEach(() => {
    inbox = {
      inbox: vi.fn().mockResolvedValue([TICKET_VIEW]),
      detail: vi.fn().mockResolvedValue({ ticket: TICKET_VIEW, messages: [] }),
      reply: vi.fn().mockResolvedValue(MESSAGE),
      assign: vi.fn().mockResolvedValue(TICKET_VIEW),
      autoAssign: vi.fn().mockResolvedValue(TICKET_VIEW),
      update: vi.fn().mockResolvedValue(TICKET_VIEW),
    };
    macros = {
      apply: vi.fn().mockResolvedValue(MESSAGE),
      list: vi.fn().mockResolvedValue([MACRO]),
      create: vi.fn().mockResolvedValue(MACRO),
      update: vi.fn().mockResolvedValue(MACRO),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    callbacks = {
      listForStaff: vi.fn().mockResolvedValue([CALLBACK]),
      complete: vi.fn().mockResolvedValue(CALLBACK),
      cancel: vi.fn().mockResolvedValue(CALLBACK),
    };

    controller = new SupportStaffController(
      inbox as unknown as InboxService,
      macros as unknown as MacroService,
      callbacks as unknown as CallbackService,
    );
  });

  it('lists the inbox with the parsed query and the staff claims', async () => {
    const query = { status: ['open'] };

    const result = await controller.inboxList(query as never, STAFF);

    expect(inbox.inbox).toHaveBeenCalledWith(query, STAFF);
    expect(result).toEqual([TICKET_VIEW]);
  });

  it('loads a ticket detail by id alone', async () => {
    const result = await controller.detail('ticket-1');

    expect(inbox.detail).toHaveBeenCalledWith('ticket-1');
    expect(result).toEqual({ ticket: TICKET_VIEW, messages: [] });
  });

  it('posts a staff reply attributed to the caller', async () => {
    const body = { body: 'We are looking into it' };

    const result = await controller.reply('ticket-1', STAFF, body as never);

    expect(inbox.reply).toHaveBeenCalledWith('ticket-1', STAFF, body);
    expect(result).toBe(MESSAGE);
  });

  it('assigns a ticket to the staff id in the body', async () => {
    const result = await controller.assign('ticket-1', STAFF, { staffId: 'staff-2' });

    expect(inbox.assign).toHaveBeenCalledWith('ticket-1', 'staff-2', STAFF);
    expect(result).toBe(TICKET_VIEW);
  });

  it('passes an undefined staff id through so the service self-assigns', async () => {
    await controller.assign('ticket-1', STAFF, {});

    expect(inbox.assign).toHaveBeenCalledWith('ticket-1', undefined, STAFF);
  });

  it('auto-assigns a ticket across the support team', async () => {
    const result = await controller.autoAssign('ticket-1');

    expect(inbox.autoAssign).toHaveBeenCalledWith('ticket-1');
    expect(result).toBe(TICKET_VIEW);
  });

  it('updates priority and status on a ticket', async () => {
    const body = { priority: 'urgent', status: 'pending' };

    const result = await controller.update('ticket-1', body as never);

    expect(inbox.update).toHaveBeenCalledWith('ticket-1', body);
    expect(result).toBe(TICKET_VIEW);
  });

  it('applies a macro to a ticket as the caller', async () => {
    const result = await controller.applyMacro('ticket-1', 'macro-1', STAFF);

    expect(macros.apply).toHaveBeenCalledWith('macro-1', 'ticket-1', STAFF);
    expect(result).toBe(MESSAGE);
  });

  it('lists, creates, updates, and removes macros', async () => {
    expect(await controller.listMacros()).toEqual([MACRO]);
    expect(macros.list).toHaveBeenCalledOnce();

    const createBody = { name: 'greeting', body: 'Hi {{customer}}' };
    expect(await controller.createMacro(STAFF, createBody as never)).toBe(MACRO);
    expect(macros.create).toHaveBeenCalledWith(STAFF, createBody);

    const updateBody = { body: 'Hello {{customer}}' };
    expect(await controller.updateMacro('macro-1', updateBody as never)).toBe(MACRO);
    expect(macros.update).toHaveBeenCalledWith('macro-1', updateBody);

    await controller.removeMacro('macro-1');
    expect(macros.remove).toHaveBeenCalledWith('macro-1');
  });

  it('lists callbacks for the staff queue', async () => {
    const query = { status: ['pending'] };

    const result = await controller.listCallbacks(query as never);

    expect(callbacks.listForStaff).toHaveBeenCalledWith(query);
    expect(result).toEqual([CALLBACK]);
  });

  it('completes a callback with the notes from the body', async () => {
    const result = await controller.completeCallback('cb-1', STAFF, { notes: 'Left voicemail' });

    expect(callbacks.complete).toHaveBeenCalledWith('cb-1', STAFF, 'Left voicemail');
    expect(result).toBe(CALLBACK);
  });

  it('completes a callback with null notes when the body omits them', async () => {
    await controller.completeCallback('cb-1', STAFF, {});

    expect(callbacks.complete).toHaveBeenCalledWith('cb-1', STAFF, null);
  });

  it('cancels a callback as the caller', async () => {
    const result = await controller.cancelCallback('cb-1', STAFF);

    expect(callbacks.cancel).toHaveBeenCalledWith('cb-1', STAFF);
    expect(result).toBe(CALLBACK);
  });
});
