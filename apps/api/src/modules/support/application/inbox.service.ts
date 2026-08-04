import type { SupportMessage } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { z } from 'zod';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import { StaffUserDoc } from '../../iam/infrastructure/iam.schemas.js';
import { pickAssignee, type AssignmentCandidate } from '../domain/ticket-assignment.js';
import { assertReplyAllowed, statusAfterReply } from '../domain/thread-permissions.js';
import { slaDeadline } from '../domain/ticket-sla.js';
import type { TicketStatus } from '../domain/ticket.types.js';
import { buildMessageDocument } from '../infrastructure/message.factory.js';
import { toStaffTicketView, toSupportMessage } from '../infrastructure/support.mapper.js';
import type {
  inboxQuerySchema,
  StaffTicketDetail,
  StaffTicketView,
  staffReplyRequestSchema,
  updateTicketRequestSchema,
} from '../infrastructure/support-requests.js';
import { SupportMessageDoc, SupportTicketDoc } from '../infrastructure/support.schemas.js';
import { AUTO_ASSIGN_ROLE, INBOX_MAX_LIMIT, OPEN_TICKET_STATUSES } from '../support.constants.js';

export type InboxQuery = z.infer<typeof inboxQuerySchema>;
export type StaffReplyInput = z.infer<typeof staffReplyRequestSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketRequestSchema>;

interface WorkloadRow {
  _id: string;
  openTickets: number;
}

/**
 * The staff inbox.
 *
 * Unlike the customer service there is no ownership filter here — the role guard is the
 * boundary, and an agent must be able to open any ticket. Assignment state is denormalised on
 * the ticket (`assignedTo` + `assignedToName`) so the inbox renders with zero lookups.
 */
@Injectable()
export class InboxService {
  constructor(
    @InjectModel(SupportTicketDoc.name) private readonly tickets: Model<SupportTicketDoc>,
    @InjectModel(SupportMessageDoc.name) private readonly messages: Model<SupportMessageDoc>,
    @InjectModel(StaffUserDoc.name) private readonly staffUsers: Model<StaffUserDoc>,
    private readonly clock: ClockService,
  ) {}

  /** The queue, most overdue first — an SLA about to breach must never sit under the fold. */
  async inbox(query: InboxQuery, staff: AccessTokenClaims): Promise<StaffTicketView[]> {
    const rows = await this.tickets
      .find(this.buildFilter(query, staff))
      .sort({ slaDueAt: 1 })
      .limit(INBOX_MAX_LIMIT)
      .lean();

    const views = rows.map((row) => toStaffTicketView(row, this.clock.now()));
    const visible = query.slaBreached ? views.filter((view) => view.slaBreached) : views;
    return visible.slice(0, query.limit);
  }

  private buildFilter(query: InboxQuery, staff: AccessTokenClaims): Record<string, unknown> {
    const filter: Record<string, unknown> = {};
    if (query.status) {
      filter['status'] = query.status;
    }
    if (query.assignedTo === 'me') {
      filter['assignedTo'] = staff.sub;
    }
    if (query.assignedTo === 'unassigned') {
      filter['assignedTo'] = null;
    }
    return filter;
  }

  async detail(ticketId: string): Promise<StaffTicketDetail> {
    const ticket = await this.loadTicket(ticketId);
    const rows = await this.messages.find({ ticketId }).sort({ sentAt: 1, _id: 1 }).lean();
    return {
      ticket: toStaffTicketView(ticket, this.clock.now()),
      messages: rows.map(toSupportMessage),
    };
  }

  /** An agent reply hands the ball to the customer — or resolves the ticket outright. */
  async reply(
    ticketId: string,
    staff: AccessTokenClaims,
    request: StaffReplyInput,
  ): Promise<SupportMessage> {
    const ticket = await this.loadTicket(ticketId);
    assertReplyAllowed(ticketId, ticket.status as TicketStatus);
    const now = this.clock.now();

    const [message] = await this.messages.create([
      buildMessageDocument({
        ticketId,
        customerId: ticket.customerId,
        author: 'agent',
        authorId: staff.sub,
        authorName: await this.displayNameFor(staff),
        body: request.body,
        attachments: request.attachments,
        sentAt: now,
      }),
    ]);

    await this.tickets.updateOne({ _id: ticketId }, this.replyUpdate(request.resolve, now));
    return toSupportMessage(message as SupportMessageDoc);
  }

  private replyUpdate(resolve: boolean, now: Date): Record<string, unknown> {
    const set: Record<string, unknown> = {
      status: resolve ? 'resolved' : statusAfterReply('agent'),
      lastMessageAt: now,
      updatedAt: now,
    };
    if (resolve) {
      set['resolvedAt'] = now;
    }
    return { $inc: { messageCount: 1 }, $set: set };
  }

  /** Assign to a named agent, or to the caller when the body carries no staff id. */
  async assign(
    ticketId: string,
    staffId: string | undefined,
    caller: AccessTokenClaims,
  ): Promise<StaffTicketView> {
    const targetId = staffId ?? caller.sub;
    const target = await this.staffUsers.findById(targetId).lean();
    if (!target) {
      throw new NotFoundError('Staff member', targetId);
    }
    return this.applyAssignment(ticketId, targetId, staffName(target));
  }

  /** Least-loaded routing across the active support team. */
  async autoAssign(ticketId: string): Promise<StaffTicketView> {
    const agents = await this.staffUsers.find({ active: true, roles: AUTO_ASSIGN_ROLE }).lean();
    const workloads = await this.openWorkloads();
    const candidates: AssignmentCandidate[] = agents.map((agent) => ({
      staffId: agent._id,
      openTickets: workloads.get(agent._id) ?? 0,
    }));

    const chosen = pickAssignee(candidates);
    if (chosen === null) {
      throw new ConflictError('No support agent is available for assignment');
    }
    const agent = agents.find((candidate) => candidate._id === chosen);
    return this.applyAssignment(ticketId, chosen, agent ? staffName(agent) : chosen);
  }

  /** Priority changes restart the SLA from the original filing time, not from now. */
  async update(ticketId: string, request: UpdateTicketInput): Promise<StaffTicketView> {
    const ticket = await this.loadTicket(ticketId);
    const set: Record<string, unknown> = { updatedAt: this.clock.now() };
    if (request.priority !== undefined) {
      set['priority'] = request.priority;
      set['slaDueAt'] = slaDeadline(request.priority, ticket.createdAt);
    }
    if (request.status !== undefined) {
      Object.assign(set, this.statusFields(request.status));
    }

    const updated = await this.tickets
      .findOneAndUpdate({ _id: ticketId }, { $set: set }, { new: true })
      .lean();
    if (!updated) {
      throw new NotFoundError('Ticket', ticketId);
    }
    return toStaffTicketView(updated, this.clock.now());
  }

  private statusFields(status: TicketStatus): Record<string, unknown> {
    const now = this.clock.now();
    return {
      status,
      resolvedAt: status === 'resolved' ? now : null,
      closedAt: status === 'closed' ? now : null,
    };
  }

  /** Any ticket, for staff eyes. Macros need this to build their render context. */
  async loadTicket(ticketId: string): Promise<SupportTicketDoc> {
    const doc = await this.tickets.findById(ticketId).lean();
    if (!doc) {
      throw new NotFoundError('Ticket', ticketId);
    }
    return doc;
  }

  /** The name shown on agent messages and macro renders. */
  async displayNameFor(staff: AccessTokenClaims): Promise<string> {
    const doc = await this.staffUsers.findById(staff.sub).lean();
    return doc ? staffName(doc) : staff.email;
  }

  private async applyAssignment(
    ticketId: string,
    staffId: string,
    name: string,
  ): Promise<StaffTicketView> {
    const updated = await this.tickets
      .findOneAndUpdate(
        { _id: ticketId },
        { $set: { assignedTo: staffId, assignedToName: name, updatedAt: this.clock.now() } },
        { new: true },
      )
      .lean();
    if (!updated) {
      throw new NotFoundError('Ticket', ticketId);
    }
    return toStaffTicketView(updated, this.clock.now());
  }

  private async openWorkloads(): Promise<Map<string, number>> {
    const rows = await this.tickets.aggregate<WorkloadRow>([
      { $match: { status: { $in: [...OPEN_TICKET_STATUSES] }, assignedTo: { $ne: null } } },
      { $group: { _id: '$assignedTo', openTickets: { $sum: 1 } } },
    ]);
    return new Map(rows.map((row) => [row._id, row.openTickets]));
  }
}

function staffName(staff: Pick<StaffUserDoc, 'firstName' | 'lastName' | 'email'>): string {
  const full = `${staff.firstName} ${staff.lastName}`.trim();
  return full.length > 0 ? full : staff.email;
}
