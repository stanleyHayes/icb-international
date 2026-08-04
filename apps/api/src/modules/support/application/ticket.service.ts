import { createTicketRequestSchema, replyToTicketRequestSchema } from '@icb/contracts';
import type { SupportMessage, SupportTicket } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { z } from 'zod';

import { NotFoundError } from '../../../common/errors/index.js';
import { newId, newReference } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { customerDisplayName } from '../../kyc/infrastructure/customer-profile.js';
import {
  assertReplyAllowed,
  assertSatisfactionAllowed,
  statusAfterReply,
} from '../domain/thread-permissions.js';
import { slaDeadline } from '../domain/ticket-sla.js';
import type { TicketStatus } from '../domain/ticket.types.js';
import { buildMessageDocument, type NewMessage } from '../infrastructure/message.factory.js';
import { toSupportMessage, toSupportTicket } from '../infrastructure/support.mapper.js';
import type { satisfactionRequestSchema } from '../infrastructure/support-requests.js';
import { SupportMessageDoc, SupportTicketDoc } from '../infrastructure/support.schemas.js';
import {
  CUSTOMER_TICKET_LIMIT,
  DEFAULT_TICKET_PRIORITY,
  TICKET_REFERENCE_PREFIX,
} from '../support.constants.js';

export type CreateTicketInput = z.infer<typeof createTicketRequestSchema>;
export type ReplyInput = z.infer<typeof replyToTicketRequestSchema>;
export type SatisfactionInput = z.infer<typeof satisfactionRequestSchema>;

/**
 * The customer's side of the support desk.
 *
 * Every read and write carries the customer id from the verified token in its query filter —
 * a ticket id alone never selects a row, which is what stops one customer reading or replying
 * to another's thread (agent_plan.md §11).
 */
@Injectable()
export class TicketService {
  constructor(
    @InjectModel(SupportTicketDoc.name) private readonly tickets: Model<SupportTicketDoc>,
    @InjectModel(SupportMessageDoc.name) private readonly messages: Model<SupportMessageDoc>,
    @InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>,
    private readonly clock: ClockService,
  ) {}

  async listForCustomer(customerId: string): Promise<SupportTicket[]> {
    const rows = await this.tickets
      .find({ customerId })
      .sort({ lastMessageAt: -1 })
      .limit(CUSTOMER_TICKET_LIMIT)
      .lean();
    return rows.map(toSupportTicket);
  }

  /** Opens a ticket with its first message; the SLA clock starts at creation. */
  async create(customerId: string, request: CreateTicketInput): Promise<SupportTicket> {
    const customerName = await this.customerNameFor(customerId);
    const now = this.clock.now();
    const ticketId = newId();

    const [ticket] = await this.tickets.create([
      {
        _id: ticketId,
        reference: newReference(TICKET_REFERENCE_PREFIX),
        customerId,
        customerName,
        subject: request.subject,
        category: request.category,
        priority: DEFAULT_TICKET_PRIORITY,
        status: 'open',
        assignedTo: null,
        assignedToName: null,
        messageCount: 1,
        lastMessageAt: now,
        slaDueAt: slaDeadline(DEFAULT_TICKET_PRIORITY, now),
        resolvedAt: null,
        closedAt: null,
        satisfaction: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    await this.messages.create([
      buildMessageDocument({
        ticketId,
        customerId,
        author: 'customer',
        authorId: customerId,
        authorName: customerName,
        body: request.body,
        attachments: request.attachments,
        sentAt: now,
      }),
    ]);

    return toSupportTicket(ticket as SupportTicketDoc);
  }

  async getForCustomer(customerId: string, ticketId: string): Promise<SupportTicket> {
    return toSupportTicket(await this.loadOwned(customerId, ticketId));
  }

  async listMessages(customerId: string, ticketId: string): Promise<SupportMessage[]> {
    await this.loadOwned(customerId, ticketId);
    const rows = await this.messages
      .find({ ticketId, customerId })
      .sort({ sentAt: 1, _id: 1 })
      .lean();
    return rows.map(toSupportMessage);
  }

  /** A customer reply hands the ball back to the agent — including on a resolved ticket. */
  async reply(customerId: string, ticketId: string, request: ReplyInput): Promise<SupportMessage> {
    const ticket = await this.loadOwned(customerId, ticketId);
    assertReplyAllowed(ticketId, ticket.status as TicketStatus);
    const now = this.clock.now();

    const [message] = await this.messages.create([
      buildMessageDocument(this.customerReply(ticket, request, now)),
    ]);

    await this.tickets.updateOne(
      { _id: ticketId },
      {
        $inc: { messageCount: 1 },
        $set: { status: statusAfterReply('customer'), lastMessageAt: now, updatedAt: now },
      },
    );

    return toSupportMessage(message as SupportMessageDoc);
  }

  private customerReply(
    ticket: SupportTicketDoc,
    request: ReplyInput,
    now: Date,
  ): NewMessage {
    return {
      ticketId: ticket._id,
      customerId: ticket.customerId,
      author: 'customer',
      authorId: ticket.customerId,
      authorName: ticket.customerName,
      body: request.body,
      attachments: request.attachments,
      sentAt: now,
    };
  }

  /**
   * CSAT capture: one rating, only once the ticket is resolved. The atomic filter enforces both
   * rules; the fallback read exists only to tell the caller *which* rule they hit.
   */
  async rateSatisfaction(
    customerId: string,
    ticketId: string,
    request: SatisfactionInput,
  ): Promise<SupportTicket> {
    const now = this.clock.now();
    const updated = await this.tickets
      .findOneAndUpdate(
        { _id: ticketId, customerId, satisfaction: null, status: { $in: ['resolved', 'closed'] } },
        {
          $set: {
            satisfaction: { rating: request.rating, comment: request.comment ?? null, ratedAt: now },
            updatedAt: now,
          },
        },
        { new: true },
      )
      .lean();

    if (!updated) {
      const ticket = await this.loadOwned(customerId, ticketId);
      assertSatisfactionAllowed({
        _id: ticketId,
        status: ticket.status as TicketStatus,
        satisfaction: ticket.satisfaction,
      });
      throw new NotFoundError('Ticket', ticketId);
    }
    return toSupportTicket(updated);
  }

  /** Ownership is part of the filter, never a comparison made after reading the document. */
  private async loadOwned(customerId: string, ticketId: string): Promise<SupportTicketDoc> {
    const doc = await this.tickets.findOne({ _id: ticketId, customerId }).lean();
    if (!doc) {
      throw new NotFoundError('Ticket', ticketId);
    }
    return doc;
  }

  private async customerNameFor(customerId: string): Promise<string> {
    const customer = await this.customers.findById(customerId).lean();
    if (!customer) {
      throw new NotFoundError('Customer', customerId);
    }
    return customerDisplayName(customer);
  }
}
