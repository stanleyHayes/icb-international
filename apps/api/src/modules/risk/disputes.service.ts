import type { CreateDisputeRequest, CursorPage, Dispute, disputeQuerySchema } from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError, NotFoundError } from '../../common/errors/index.js';
import { buildCursorPage, decodeCursor } from '../../common/pagination/cursor.js';
import { newId, newReference } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import {
  DisputeStageService,
  type AdvanceDisputeRequest,
  type StaffActor,
} from './application/dispute-stage.service.js';
import { DisputeSubjectResolver, type DisputeSubject } from './application/dispute-subject.resolver.js';
import { slaBusinessDaysFor } from './domain/dispute-sla.js';
import { INITIAL_STAGE, isTerminal } from './domain/dispute-stages.js';
import { toDispute } from './infrastructure/dispute.mapper.js';
import { DisputeDoc, type DisputeEvidenceSub } from './infrastructure/dispute.schemas.js';

export type DisputeQuery = ReturnType<typeof disputeQuerySchema.parse>;
export type EvidenceItem = CreateDisputeRequest['evidence'][number];

/** Keyset pagination over the staff queue is on (deadline, id); this joins the two halves. */
const QUEUE_KEY_SEPARATOR = '|';

/**
 * Disputes and chargebacks.
 *
 * A dispute is a claim on money that has already moved, so it is stored as an immutable timeline
 * with an SLA clock attached, and it never edits the original transaction. Everything the bank
 * does in response — provisional credit, clawback — is a new posting that the customer can see.
 */
@Injectable()
export class DisputesService {
  private readonly logger = new Logger(DisputesService.name);

  constructor(
    @InjectModel(DisputeDoc.name) private readonly disputes: Model<DisputeDoc>,
    private readonly subjects: DisputeSubjectResolver,
    private readonly stages: DisputeStageService,
    private readonly clock: ClockService,
  ) {}

  async raise(customerId: string, request: CreateDisputeRequest): Promise<Dispute> {
    const subject = await this.subjects.resolve(customerId, request.transactionId);

    if (await this.disputes.exists({ transactionId: request.transactionId })) {
      throw new ConflictError('This transaction is already under dispute', {
        transactionId: request.transactionId,
      });
    }

    const [created] = await this.disputes.create([
      this.newDispute(customerId, request, subject),
    ]);
    if (!created) {
      throw new ConflictError('The dispute could not be raised');
    }

    this.logger.log(
      { disputeId: created._id, reason: request.reason, reference: created.reference },
      'Dispute raised',
    );
    return toDispute(created);
  }

  private newDispute(
    customerId: string,
    request: CreateDisputeRequest,
    subject: DisputeSubject,
  ): DisputeDoc {
    const now = this.clock.now();
    return {
      _id: newId(),
      reference: newReference('DSP'),
      transactionId: request.transactionId,
      customerId,
      customerName: subject.customerName,
      accountId: subject.accountId,
      amountMinorUnits: subject.amountMinorUnits,
      currency: subject.currency,
      reason: request.reason,
      detail: request.detail,
      contactedMerchant: request.contactedMerchant,
      stage: INITIAL_STAGE,
      outcome: null,
      evidence: request.evidence.map((item) => this.toEvidence(item, 'customer', now)),
      provisionalCredit: null,
      timeline: [
        { at: now, stage: INITIAL_STAGE, note: `Dispute raised against ${subject.description}` },
      ],
      slaDueAt: this.clock.addBusinessDays(slaBusinessDaysFor(request.reason), now),
      resolvedAt: null,
      assignedTo: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  private toEvidence(item: EvidenceItem, uploadedBy: string, at: Date): DisputeEvidenceSub {
    return { id: newId(), label: item.label, asset: item.asset, uploadedBy, uploadedAt: at };
  }

  /** The customer's own disputes, newest first. Ownership is in the query, not a later check. */
  async listForCustomer(customerId: string, query: DisputeQuery): Promise<CursorPage<Dispute>> {
    const filter: Record<string, unknown> = { customerId, ...this.commonFilter(query) };
    if (query.cursor) {
      filter['_id'] = { $lt: decodeCursor(query.cursor) };
    }

    const rows = await this.disputes
      .find(filter)
      .sort({ _id: -1 })
      .limit(query.limit + 1)
      .lean();

    return buildCursorPage(rows.map(toDispute), query.limit, (dispute) => dispute.id);
  }

  async getForCustomer(disputeId: string, customerId: string): Promise<Dispute> {
    return toDispute(await this.mustFindForCustomer(disputeId, customerId));
  }

  /**
   * The staff queue, most overdue first.
   *
   * Paged by keyset on (deadline, id) rather than by offset: the queue is worked while new
   * disputes arrive, and an offset would silently skip or repeat cases as it shifted underneath.
   */
  async queue(query: DisputeQuery): Promise<CursorPage<Dispute>> {
    const filter: Record<string, unknown> = { ...this.commonFilter(query) };
    if (query.overdueOnly) {
      filter['slaDueAt'] = { $lt: this.clock.now() };
      filter['stage'] = { $ne: 'resolved' };
    }
    Object.assign(filter, this.queueCursorFilter(query.cursor));

    const rows = await this.disputes
      .find(filter)
      .sort({ slaDueAt: 1, _id: 1 })
      .limit(query.limit + 1)
      .lean();

    return buildCursorPage(
      rows.map(toDispute),
      query.limit,
      (dispute) => `${dispute.slaDueAt}${QUEUE_KEY_SEPARATOR}${dispute.id}`,
    );
  }

  private queueCursorFilter(cursor: string | undefined): Record<string, unknown> {
    if (!cursor) {
      return {};
    }
    const [dueAt = '', id = ''] = decodeCursor(cursor).split(QUEUE_KEY_SEPARATOR);
    const deadline = new Date(dueAt);
    return {
      $or: [{ slaDueAt: { $gt: deadline } }, { slaDueAt: deadline, _id: { $gt: id } }],
    };
  }

  private commonFilter(query: DisputeQuery): Record<string, unknown> {
    return {
      ...(query.stage?.length ? { stage: { $in: query.stage } } : {}),
      ...(query.reason?.length ? { reason: { $in: query.reason } } : {}),
    };
  }

  /** Evidence the customer adds after the fact — a receipt they found, a merchant email. */
  async attachEvidence(
    disputeId: string,
    customerId: string,
    items: readonly EvidenceItem[],
  ): Promise<Dispute> {
    const dispute = await this.mustFindForCustomer(disputeId, customerId);
    if (isTerminal(dispute.stage as Dispute['stage'])) {
      throw new ConflictError('This dispute is closed and cannot take further evidence', {
        disputeId,
      });
    }

    const now = this.clock.now();
    await this.disputes.updateOne(
      { _id: disputeId, customerId },
      {
        $push: { evidence: { $each: items.map((item) => this.toEvidence(item, 'customer', now)) } },
        $set: { updatedAt: now },
      },
    );
    return this.getForCustomer(disputeId, customerId);
  }

  async advance(
    disputeId: string,
    staff: StaffActor,
    request: AdvanceDisputeRequest,
  ): Promise<Dispute> {
    return toDispute(await this.stages.advance(disputeId, staff, request));
  }

  async byIdForStaff(disputeId: string): Promise<Dispute> {
    const dispute = await this.disputes.findById(disputeId).lean();
    if (!dispute) {
      throw new NotFoundError('Dispute', disputeId);
    }
    return toDispute(dispute);
  }

  private async mustFindForCustomer(disputeId: string, customerId: string): Promise<DisputeDoc> {
    const dispute = await this.disputes.findOne({ _id: disputeId, customerId }).lean();
    if (!dispute) {
      throw new NotFoundError('Dispute', disputeId);
    }
    return dispute;
  }
}
