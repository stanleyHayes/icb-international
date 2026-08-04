import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { CallbackView, SupportTicket } from '@icb/contracts';
import { supportOperations } from '@icb/contracts/openapi/routes/support';
import { ContractContext, fillPath, operationOf, requireInfra } from '../contract-context.js';
import {
  bootContractApp,
  closeContractApp,
  type BootResult,
  type ContractApp,
} from '../harness.js';

/**
 * Contract suite: support (tickets, threads, callbacks, the staff queues).
 *
 * The seed opens no tickets and requests no callbacks, so every fixture is created through the
 * API first — which doubles as coverage for the mutations' success schemas. Staff-side reads
 * use the all-roles staff token. One staff endpoint (ticket update) sits outside the route
 * table; it is used purely as setup to resolve a ticket for the CSAT mutation.
 */
describe('contract: support', () => {
  let boot: BootResult;
  let app: ContractApp | undefined;
  let ctx: ContractContext;

  beforeAll(async () => {
    boot = await bootContractApp();
    if (boot.available) {
      app = boot.app;
      ctx = new ContractContext(app);
    }
  });

  afterAll(async () => {
    if (app && ctx) {
      ctx.assertCovered(supportOperations);
      await closeContractApp(app);
    }
  });

  it('createTicket / listTickets / getTicket / listTicketMessages — a new ticket reads back as declared', async (t) => {
    requireInfra(t, boot);
    const ticket = await openTicket(ctx);

    ctx.expectContract('listTickets', await ctx.get('/support/tickets'));

    const detailPath = fillPath(operationOf('getTicket').path, { ticketId: ticket.id });
    ctx.expectContract('getTicket', await ctx.get(detailPath));

    const messagesPath = fillPath(operationOf('listTicketMessages').path, { ticketId: ticket.id });
    ctx.expectContract('listTicketMessages', await ctx.get(messagesPath));
  });

  it('replyToTicket — a reply on the thread returns the declared message shape', async (t) => {
    requireInfra(t, boot);
    const ticket = await openTicket(ctx);
    const res = await ctx.post(`/support/tickets/${ticket.id}/messages`, {
      body: 'Adding the transaction reference the team asked for.',
    });
    ctx.expectContract('replyToTicket', res);
  });

  it('rateTicketSatisfaction — a resolved ticket accepts a CSAT rating', async (t) => {
    requireInfra(t, boot);
    const ticket = await openTicket(ctx);
    // Resolution has no contracted route (staff ticket update is absent from the route table),
    // so the staff console endpoint is used purely as setup for the customer-facing mutation.
    const resolved = await ctx.patch(
      `/support/staff/tickets/${ticket.id}`,
      { status: 'resolved' },
      'staff',
    );
    expect(resolved.status).toBe(200);

    const res = await ctx.post(`/support/tickets/${ticket.id}/satisfaction`, {
      rating: 5,
      comment: 'Sorted in one exchange.',
    });
    ctx.expectContract('rateTicketSatisfaction', res);
  });

  it('requestCallback / listCallbacks — a requested callback lists as declared', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('requestCallback', await ctx.post('/support/callbacks', callbackPayload()));
    ctx.expectContract('listCallbacks', await ctx.get('/support/callbacks'));
  });

  it('completeCallback / cancelCallback — staff works the callback queue', async (t) => {
    requireInfra(t, boot);
    const done = ctx.expectContract(
      'requestCallback',
      await ctx.post('/support/callbacks', callbackPayload()),
    ) as CallbackView;
    const completePath = fillPath(operationOf('completeCallback').path, { callbackId: done.id });
    const completed = await ctx.post(completePath, { notes: 'Reached on the second attempt.' }, 'staff');
    ctx.expectContract('completeCallback', completed);

    const abandoned = ctx.expectContract(
      'requestCallback',
      await ctx.post('/support/callbacks', callbackPayload()),
    ) as CallbackView;
    const cancelPath = fillPath(operationOf('cancelCallback').path, { callbackId: abandoned.id });
    ctx.expectContract('cancelCallback', await ctx.post(cancelPath, {}, 'staff'));
  });

  it('listSupportInbox / listStaffCallbacks — the staff queues parse as declared', async (t) => {
    requireInfra(t, boot);
    // One real row in each queue beats asserting against empty arrays.
    await openTicket(ctx);
    await ctx.post('/support/callbacks', callbackPayload());

    ctx.expectContract('listSupportInbox', await ctx.get('/support/staff/inbox', 'staff'));
    ctx.expectContract('listStaffCallbacks', await ctx.get('/support/staff/callbacks', 'staff'));
  });

  it('signSupportAttachmentUpload — a valid request returns the declared upload signature', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.post('/support/attachments/upload-signature', {
      filename: 'transaction-screenshot.png',
      contentType: 'image/png',
      sizeBytes: 64 * 1024,
    });
    ctx.expectContract('signSupportAttachmentUpload', res);
  });
});

/** Opens a ticket through the contracted mutation and returns the parsed ticket. */
async function openTicket(ctx: ContractContext): Promise<SupportTicket> {
  const res = await ctx.post('/support/tickets', {
    subject: 'Statement figure looks wrong',
    category: 'account',
    body: 'The closing balance on my latest statement does not match the app.',
  });
  return ctx.expectContract('createTicket', res) as SupportTicket;
}

/** A callback request the schema accepts; the phone is the seeded bank's own format. */
function callbackPayload(): { phone: string; reason: string; preferredWindow: 'morning' } {
  return {
    phone: '+233302000001',
    reason: 'Please walk me through a charge I do not recognise.',
    preferredWindow: 'morning',
  };
}
