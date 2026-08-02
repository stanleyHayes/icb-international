import { z } from 'zod';
import {
  createTicketRequestSchema,
  replyToTicketRequestSchema,
  supportMessageSchema,
  supportTicketSchema,
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
};

export function createSupportApi(call: Requester) {
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
  };
}

export type SupportApi = ReturnType<typeof createSupportApi>;
