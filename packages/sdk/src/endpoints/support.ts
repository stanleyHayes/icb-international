import { z } from 'zod';
import {
  attachmentUploadRequestSchema,
  callbackCompleteRequestSchema,
  callbackRequestSchema,
  callbackViewSchema,
  createTicketRequestSchema,
  inboxQuerySchema,
  replyToTicketRequestSchema,
  satisfactionRequestSchema,
  staffCallbackQuerySchema,
  staffTicketViewSchema,
  supportMessageSchema,
  supportTicketSchema,
  uploadSignatureSchema,
} from '@icb/contracts';

import { get, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const supportEndpoints = {
  listTickets: get('/support/tickets', z.array(supportTicketSchema)),
  createTicket: post('/support/tickets', supportTicketSchema, { body: createTicketRequestSchema }),
  getTicket: get('/support/tickets/:ticketId', supportTicketSchema),
  listMessages: get('/support/tickets/:ticketId/messages', z.array(supportMessageSchema)),
  reply: post('/support/tickets/:ticketId/messages', supportMessageSchema, {
    body: replyToTicketRequestSchema,
  }),
  rateSatisfaction: post('/support/tickets/:ticketId/satisfaction', supportTicketSchema, {
    body: satisfactionRequestSchema,
  }),
  createAttachmentUploadSignature: post(
    '/support/attachments/upload-signature',
    uploadSignatureSchema,
    { body: attachmentUploadRequestSchema, idempotent: true },
  ),
  requestCallback: post('/support/callbacks', callbackViewSchema, {
    body: callbackRequestSchema,
    idempotent: true,
  }),
  listCallbacks: get('/support/callbacks', z.array(callbackViewSchema)),
  staffInbox: get('/support/staff/inbox', z.array(staffTicketViewSchema), {
    query: inboxQuerySchema,
  }),
  staffListCallbacks: get('/support/staff/callbacks', z.array(callbackViewSchema), {
    query: staffCallbackQuerySchema,
  }),
  staffCompleteCallback: post(
    '/support/staff/callbacks/:callbackId/complete',
    callbackViewSchema,
    { body: callbackCompleteRequestSchema },
  ),
  staffCancelCallback: post('/support/staff/callbacks/:callbackId/cancel', callbackViewSchema, {}),
};

function createTicketMethods(call: Requester) {
  return {
    listTickets: (options?: RequestOptions) => call(supportEndpoints.listTickets, { options }),
    createTicket: (body: z.input<typeof createTicketRequestSchema>, options?: RequestOptions) =>
      call(supportEndpoints.createTicket, { body, options }),
    getTicket: (ticketId: string, options?: RequestOptions) =>
      call(supportEndpoints.getTicket, { params: { ticketId }, options }),
    listMessages: (ticketId: string, options?: RequestOptions) =>
      call(supportEndpoints.listMessages, { params: { ticketId }, options }),
    reply: (
      ticketId: string,
      body: z.input<typeof replyToTicketRequestSchema>,
      options?: RequestOptions,
    ) => call(supportEndpoints.reply, { params: { ticketId }, body, options }),
    rateSatisfaction: (
      ticketId: string,
      body: z.input<typeof satisfactionRequestSchema>,
      options?: RequestOptions,
    ) => call(supportEndpoints.rateSatisfaction, { params: { ticketId }, body, options }),
    createAttachmentUploadSignature: (
      body: z.input<typeof attachmentUploadRequestSchema>,
      options?: RequestOptions,
    ) => call(supportEndpoints.createAttachmentUploadSignature, { body, options }),
    staffInbox: (query?: z.input<typeof inboxQuerySchema>, options?: RequestOptions) =>
      call(supportEndpoints.staffInbox, { query, options }),
  };
}

function createCallbackMethods(call: Requester) {
  return {
    requestCallback: (body: z.input<typeof callbackRequestSchema>, options?: RequestOptions) =>
      call(supportEndpoints.requestCallback, { body, options }),
    listCallbacks: (options?: RequestOptions) => call(supportEndpoints.listCallbacks, { options }),
    staffListCallbacks: (
      query?: z.input<typeof staffCallbackQuerySchema>,
      options?: RequestOptions,
    ) => call(supportEndpoints.staffListCallbacks, { query, options }),
    staffCompleteCallback: (
      callbackId: string,
      body: z.input<typeof callbackCompleteRequestSchema>,
      options?: RequestOptions,
    ) => call(supportEndpoints.staffCompleteCallback, { params: { callbackId }, body, options }),
    staffCancelCallback: (callbackId: string, options?: RequestOptions) =>
      call(supportEndpoints.staffCancelCallback, { params: { callbackId }, options }),
  };
}

export function createSupportApi(call: Requester) {
  return { ...createTicketMethods(call), ...createCallbackMethods(call) };
}

export type SupportApi = ReturnType<typeof createSupportApi>;
