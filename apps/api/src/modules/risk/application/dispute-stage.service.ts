import type { DisputeOutcome, DisputeReason, DisputeStage, advanceDisputeRequestSchema } from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError, NotFoundError, ValidationError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { PostingActor } from '../../ledger/domain/posting.types.js';
import { qualifiesForProvisionalCredit } from '../domain/dispute-sla.js';
import {
  TERMINAL_STAGE,
  allowedNextStages,
  canAdvance,
  grantsCreditOnResolution,
  isInCustomerFavour,
} from '../domain/dispute-stages.js';
import { DisputeDoc, type ProvisionalCreditSub } from '../infrastructure/dispute.schemas.js';
import { DisputeCreditService } from './dispute-credit.service.js';

export type AdvanceDisputeRequest = ReturnType<typeof advanceDisputeRequestSchema.parse>;

export interface StaffActor {
  readonly id: string;
  readonly label: string;
}

/**
 * The stage machine, and the money that hangs off it.
 *
 * Every transition is checked against the machine rather than trusted from the request, and the
 * ledger posting happens *before* the stage is written. If the posting fails the dispute stays
 * where it was — the alternative is a dispute that claims a credit the customer never received.
 */
@Injectable()
export class DisputeStageService {
  private readonly logger = new Logger(DisputeStageService.name);

  constructor(
    @InjectModel(DisputeDoc.name) private readonly disputes: Model<DisputeDoc>,
    private readonly credits: DisputeCreditService,
    private readonly clock: ClockService,
  ) {}

  async advance(
    disputeId: string,
    staff: StaffActor,
    request: AdvanceDisputeRequest,
  ): Promise<DisputeDoc> {
    const dispute = await this.mustFind(disputeId);
    const from = dispute.stage as DisputeStage;

    if (!canAdvance(from, request.stage)) {
      throw new ConflictError(`A dispute at ${from} cannot move to ${request.stage}`, {
        disputeId,
        allowed: allowedNextStages(from),
      });
    }

    const actor: PostingActor = { kind: 'staff', id: staff.id, label: staff.label };
    const credit = await this.applyMoney(dispute, request, actor);
    await this.writeStage(dispute, request, staff, credit);

    this.logger.log({ disputeId, from, to: request.stage, by: staff.id }, 'Dispute advanced');
    return this.mustFind(disputeId);
  }

  /** Persist the new stage, its timeline entry, and whatever the money step produced. */
  private async writeStage(
    dispute: DisputeDoc,
    request: AdvanceDisputeRequest,
    staff: StaffActor,
    credit: ProvisionalCreditSub | null,
  ): Promise<void> {
    const now = this.clock.now();
    const resolved = request.stage === TERMINAL_STAGE;

    await this.disputes.updateOne(
      { _id: dispute._id },
      {
        $set: {
          stage: request.stage,
          outcome: request.outcome ?? dispute.outcome,
          provisionalCredit: credit,
          resolvedAt: resolved ? now : dispute.resolvedAt,
          assignedTo: dispute.assignedTo ?? staff.id,
          updatedAt: now,
        },
        $push: { timeline: { at: now, stage: request.stage, note: request.note } },
      },
    );
  }

  /**
   * The money effect of a transition, if any.
   *
   * Entering `provisional_credit` grants it; an explicit flag grants it from any stage, because
   * an analyst who has already seen the evidence should not have to walk a case through an extra
   * stage before making the customer whole.
   */
  private async applyMoney(
    dispute: DisputeDoc,
    request: AdvanceDisputeRequest,
    actor: PostingActor,
  ): Promise<ProvisionalCreditSub | null> {
    if (request.stage === TERMINAL_STAGE) {
      return this.settle(dispute, request.outcome, actor);
    }

    const wanted = request.stage === 'provisional_credit' || request.grantProvisionalCredit === true;
    if (!wanted || this.hasLiveCredit(dispute)) {
      return dispute.provisionalCredit;
    }

    if (!qualifiesForProvisionalCredit(dispute.reason as DisputeReason)) {
      throw new ConflictError('This dispute reason does not qualify for provisional credit', {
        disputeId: dispute._id,
        reason: dispute.reason,
      });
    }
    return this.credits.grant(dispute, actor);
  }

  /**
   * Resolution. In the customer's favour the credit stands — and is created if it was never
   * granted; against them it is clawed back by reversing the original posting.
   */
  private async settle(
    dispute: DisputeDoc,
    outcome: DisputeOutcome | undefined,
    actor: PostingActor,
  ): Promise<ProvisionalCreditSub | null> {
    if (!outcome) {
      throw new ValidationError('A dispute can only be resolved with an outcome', [
        { path: 'outcome', message: 'An outcome is required when resolving a dispute' },
      ]);
    }

    if (isInCustomerFavour(outcome)) {
      return this.hasLiveCredit(dispute) || !grantsCreditOnResolution(outcome)
        ? dispute.provisionalCredit
        : this.credits.grant(dispute, actor);
    }

    if (!this.hasLiveCredit(dispute)) {
      return dispute.provisionalCredit;
    }
    return this.credits.clawBack(
      dispute,
      `Dispute ${dispute.reference} resolved against the customer (${outcome})`,
      actor,
    );
  }

  private hasLiveCredit(dispute: DisputeDoc): boolean {
    return dispute.provisionalCredit !== null && dispute.provisionalCredit.clawedBackAt === null;
  }

  private async mustFind(disputeId: string): Promise<DisputeDoc> {
    const dispute = await this.disputes.findById(disputeId).lean();
    if (!dispute) {
      throw new NotFoundError('Dispute', disputeId);
    }
    return dispute;
  }
}
