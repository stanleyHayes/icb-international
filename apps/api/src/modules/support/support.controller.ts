import {
  createTicketRequestSchema,
  replyToTicketRequestSchema,
  type SupportMessage,
  type SupportTicket,
  type UploadSignature,
} from '@icb/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { AttachmentSignatureService } from './application/attachment-signature.service.js';
import { CallbackService } from './application/callback.service.js';
import { TicketService } from './application/ticket.service.js';
import {
  attachmentUploadRequestSchema,
  callbackRequestSchema,
  satisfactionRequestSchema,
  type CallbackView,
} from './infrastructure/support-requests.js';

/**
 * The customer's side of support.
 *
 * Every route derives the customer from the verified token, and the services carry that id in
 * their query filters — a ticket id alone never selects a row (agent_plan.md §11). Route paths
 * for tickets and messages match `@icb/sdk`'s `supportEndpoints` exactly.
 */
@Controller('support')
export class SupportController {
  constructor(
    private readonly tickets: TicketService,
    private readonly callbacks: CallbackService,
    private readonly signatures: AttachmentSignatureService,
  ) {}

  @Get('tickets')
  listTickets(@CurrentCustomer() customerId: string): Promise<SupportTicket[]> {
    return this.tickets.listForCustomer(customerId);
  }

  @Post('tickets')
  createTicket(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(createTicketRequestSchema))
    body: ReturnType<typeof createTicketRequestSchema.parse>,
  ): Promise<SupportTicket> {
    return this.tickets.create(customerId, body);
  }

  @Get('tickets/:ticketId')
  getTicket(
    @CurrentCustomer() customerId: string,
    @Param('ticketId') ticketId: string,
  ): Promise<SupportTicket> {
    return this.tickets.getForCustomer(customerId, ticketId);
  }

  @Get('tickets/:ticketId/messages')
  listMessages(
    @CurrentCustomer() customerId: string,
    @Param('ticketId') ticketId: string,
  ): Promise<SupportMessage[]> {
    return this.tickets.listMessages(customerId, ticketId);
  }

  @Post('tickets/:ticketId/messages')
  reply(
    @CurrentCustomer() customerId: string,
    @Param('ticketId') ticketId: string,
    @Body(zodBody(replyToTicketRequestSchema))
    body: ReturnType<typeof replyToTicketRequestSchema.parse>,
  ): Promise<SupportMessage> {
    return this.tickets.reply(customerId, ticketId, body);
  }

  /** CSAT: one rating per ticket, once it is resolved. */
  @Post('tickets/:ticketId/satisfaction')
  @HttpCode(HttpStatus.OK)
  rateSatisfaction(
    @CurrentCustomer() customerId: string,
    @Param('ticketId') ticketId: string,
    @Body(zodBody(satisfactionRequestSchema))
    body: ReturnType<typeof satisfactionRequestSchema.parse>,
  ): Promise<SupportTicket> {
    return this.tickets.rateSatisfaction(customerId, ticketId, body);
  }

  /**
   * Mints a short-lived signature so the browser can upload an attachment straight to the
   * storage provider. The bytes never reach this API.
   */
  @Post('attachments/upload-signature')
  @HttpCode(HttpStatus.OK)
  uploadSignature(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(attachmentUploadRequestSchema))
    body: ReturnType<typeof attachmentUploadRequestSchema.parse>,
  ): UploadSignature {
    return this.signatures.mint(customerId, body);
  }

  @Post('callbacks')
  requestCallback(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(callbackRequestSchema))
    body: ReturnType<typeof callbackRequestSchema.parse>,
  ): Promise<CallbackView> {
    return this.callbacks.request(customerId, body);
  }

  @Get('callbacks')
  listCallbacks(@CurrentCustomer() customerId: string): Promise<CallbackView[]> {
    return this.callbacks.listForCustomer(customerId);
  }
}
