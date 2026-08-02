import {
  createTicketRequestSchema,
  replyToTicketRequestSchema,
  supportMessageSchema,
  supportTicketSchema,
} from '../../../src/index.js';
import { idSchema } from '../../../src/common/primitives.js';
import { cursorQuerySchema } from '../../../src/common/pagination.js';
import { PAGE_SCHEMAS } from '../components.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

const TICKET_ID = { ticketId: idSchema } as const;

export const supportOperations = defineOperations([
  {
    method: 'get', path: '/support/tickets', tag: TAG.support, operationId: 'listTickets',
    summary: 'The customer’s support tickets',
    query: cursorQuerySchema,
    response: success(STATUS.ok, 'A cursor page of tickets.', PAGE_SCHEMAS.SupportTicketPage),
  },
  {
    method: 'post', path: '/support/tickets', tag: TAG.support, operationId: 'createTicket',
    summary: 'Open a ticket',
    request: createTicketRequestSchema,
    response: success(STATUS.created, 'The created ticket.', supportTicketSchema),
    errors: [{ status: STATUS.unprocessable }],
  },
  {
    method: 'get', path: '/support/tickets/{ticketId}', tag: TAG.support, operationId: 'getTicket',
    summary: 'Ticket detail',
    pathParams: TICKET_ID,
    response: success(STATUS.ok, 'The ticket.', supportTicketSchema),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'get', path: '/support/tickets/{ticketId}/messages', tag: TAG.support,
    operationId: 'listTicketMessages', summary: 'The secure-message thread',
    pathParams: TICKET_ID,
    query: cursorQuerySchema,
    response: success(STATUS.ok, 'A cursor page of messages.', PAGE_SCHEMAS.SupportMessagePage),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'post', path: '/support/tickets/{ticketId}/messages', tag: TAG.support,
    operationId: 'replyToTicket', summary: 'Reply on the thread',
    pathParams: TICKET_ID,
    request: replyToTicketRequestSchema,
    response: success(STATUS.created, 'The posted message.', supportMessageSchema),
    errors: [{ status: STATUS.notFound }, { status: STATUS.conflict, description: 'The ticket is closed.' }],
  },
]);
