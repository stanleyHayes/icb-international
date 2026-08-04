import type { SupportMessage, SupportTicket, UploadSignature } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type AttachmentSignatureService } from '../application/attachment-signature.service.js';
import { type CallbackService } from '../application/callback.service.js';
import { type TicketService } from '../application/ticket.service.js';
import type { CallbackView } from '../infrastructure/support-requests.js';
import { SupportController } from '../support.controller.js';

const TICKET = { id: 'ticket-1', status: 'open' } as unknown as SupportTicket;
const MESSAGE = { id: 'msg-1', body: 'hello' } as unknown as SupportMessage;
const CALLBACK = { id: 'cb-1', status: 'pending' } as unknown as CallbackView;
const SIGNATURE = {
  uploadUrl: 'https://uploads.example.com/cust-1',
  fields: { key: 'cust-1/att-1' },
  expiresAt: '2026-08-04T10:05:00.000Z',
} as unknown as UploadSignature;

describe('SupportController', () => {
  let tickets: Record<string, ReturnType<typeof vi.fn>>;
  let callbacks: { request: ReturnType<typeof vi.fn>; listForCustomer: ReturnType<typeof vi.fn> };
  let signatures: { mint: ReturnType<typeof vi.fn> };
  let controller: SupportController;

  beforeEach(() => {
    tickets = {
      listForCustomer: vi.fn().mockResolvedValue([TICKET]),
      create: vi.fn().mockResolvedValue(TICKET),
      getForCustomer: vi.fn().mockResolvedValue(TICKET),
      listMessages: vi.fn().mockResolvedValue([MESSAGE]),
      reply: vi.fn().mockResolvedValue(MESSAGE),
      rateSatisfaction: vi.fn().mockResolvedValue(TICKET),
    };
    callbacks = {
      request: vi.fn().mockResolvedValue(CALLBACK),
      listForCustomer: vi.fn().mockResolvedValue([CALLBACK]),
    };
    signatures = { mint: vi.fn().mockReturnValue(SIGNATURE) };

    controller = new SupportController(
      tickets as unknown as TicketService,
      callbacks as unknown as CallbackService,
      signatures as unknown as AttachmentSignatureService,
    );
  });

  it('lists the caller tickets', async () => {
    const result = await controller.listTickets('cust-1');

    expect(tickets.listForCustomer).toHaveBeenCalledWith('cust-1');
    expect(result).toEqual([TICKET]);
  });

  it('creates a ticket owned by the token customer', async () => {
    const body = { subject: 'Card not delivered', category: 'cards', body: 'It has been weeks' };

    const result = await controller.createTicket('cust-1', body as never);

    expect(tickets.create).toHaveBeenCalledWith('cust-1', body);
    expect(result).toBe(TICKET);
  });

  it('loads one ticket scoped to the caller', async () => {
    const result = await controller.getTicket('cust-1', 'ticket-1');

    expect(tickets.getForCustomer).toHaveBeenCalledWith('cust-1', 'ticket-1');
    expect(result).toBe(TICKET);
  });

  it('lists messages on a caller-owned ticket', async () => {
    const result = await controller.listMessages('cust-1', 'ticket-1');

    expect(tickets.listMessages).toHaveBeenCalledWith('cust-1', 'ticket-1');
    expect(result).toEqual([MESSAGE]);
  });

  it('posts a reply on a caller-owned ticket', async () => {
    const body = { body: 'Any update?' };

    const result = await controller.reply('cust-1', 'ticket-1', body as never);

    expect(tickets.reply).toHaveBeenCalledWith('cust-1', 'ticket-1', body);
    expect(result).toBe(MESSAGE);
  });

  it('records a CSAT rating for the ticket', async () => {
    const body = { rating: 5, comment: 'Great help' };

    const result = await controller.rateSatisfaction('cust-1', 'ticket-1', body);

    expect(tickets.rateSatisfaction).toHaveBeenCalledWith('cust-1', 'ticket-1', body);
    expect(result).toBe(TICKET);
  });

  it('mints an attachment upload signature scoped to the caller', () => {
    const body = { filename: 'screenshot.png', contentType: 'image/png', byteSize: 2048 };

    const result = controller.uploadSignature('cust-1', body as never);

    expect(signatures.mint).toHaveBeenCalledWith('cust-1', body);
    expect(result).toBe(SIGNATURE);
  });

  it('requests a callback for the caller', async () => {
    const body = { phone: '+15551234567', topic: 'fraud' };

    const result = await controller.requestCallback('cust-1', body as never);

    expect(callbacks.request).toHaveBeenCalledWith('cust-1', body);
    expect(result).toBe(CALLBACK);
  });

  it('lists the caller callbacks', async () => {
    const result = await controller.listCallbacks('cust-1');

    expect(callbacks.listForCustomer).toHaveBeenCalledWith('cust-1');
    expect(result).toEqual([CALLBACK]);
  });
});
