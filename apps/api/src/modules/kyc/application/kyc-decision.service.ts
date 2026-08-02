import type { KycCase, KycDecisionRequest, KycLevel, KycStatus, RiskRating } from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { toKycCase } from '../infrastructure/kyc.mapper.js';
import { KycCaseDoc, type KycDecisionSub } from '../infrastructure/kyc.schemas.js';

/**
 * Decisioning.
 *
 * A decision is the only thing in this module that changes what a customer may do, so it is the
 * only thing that writes to the customer record. Case and customer are updated in one database
 * transaction: a world where the case says "approved tier 3" and the customer record still says
 * tier 1 is a world where the limits engine silently disagrees with the audit trail.
 */

export interface DecisionActor {
  readonly id: string;
  readonly label: string;
}

interface ApplyDecisionInput {
  readonly caseId: string;
  readonly decision: KycDecisionSub;
  readonly riskRating: RiskRating | null;
  readonly now: Date;
  readonly session: ClientSession;
}

const STATUS_BY_OUTCOME: Readonly<Record<KycDecisionRequest['outcome'], KycStatus>> = {
  approved: 'approved',
  rejected: 'rejected',
  more_info_required: 'more_info_required',
};

@Injectable()
export class KycDecisionService {
  private readonly logger = new Logger(KycDecisionService.name);

  constructor(
    @InjectModel(KycCaseDoc.name) private readonly cases: Model<KycCaseDoc>,
    @InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>,
    private readonly transactionManager: TransactionManager,
    private readonly clock: ClockService,
  ) {}

  async decide(
    caseId: string,
    actor: DecisionActor,
    request: KycDecisionRequest,
  ): Promise<KycCase> {
    const existing = await this.cases.findById(caseId).lean();
    if (!existing) {
      throw new NotFoundError('KYC case', caseId);
    }
    assertDecidable(existing);

    const now = this.clock.now();
    const decision: KycDecisionSub = {
      outcome: request.outcome,
      grantedLevel: grantedLevelFor(request, existing),
      reason: request.reason,
      decidedBy: actor.label,
      decidedAt: now,
    };
    const riskRating = request.riskRating ?? (existing.riskRating as RiskRating | null);

    const updated = await this.transactionManager.withTransaction((session) =>
      this.applyDecision({ caseId, decision, riskRating, now, session }),
    );

    this.logger.log(
      { caseId, outcome: request.outcome, grantedLevel: decision.grantedLevel, actor: actor.id },
      'KYC case decided',
    );
    return toKycCase(updated);
  }

  /** Case and customer, together or not at all. */
  private async applyDecision(input: ApplyDecisionInput): Promise<KycCaseDoc> {
    const updated = await this.cases
      .findOneAndUpdate(
        { _id: input.caseId },
        {
          $set: {
            decision: input.decision,
            status: STATUS_BY_OUTCOME[input.decision.outcome as KycDecisionRequest['outcome']],
            riskRating: input.riskRating,
            updatedAt: input.now,
          },
        },
        { new: true, session: input.session },
      )
      .lean();

    if (!updated) {
      throw new NotFoundError('KYC case', input.caseId);
    }

    await this.writeBackToCustomer(updated.customerId, input);
    return updated;
  }

  /**
   * The tier lands on the customer record, where the limits engine reads it. A rejected upgrade
   * deliberately leaves an existing tier alone: failing to reach tier 3 does not revoke tier 2.
   */
  private async writeBackToCustomer(customerId: string, input: ApplyDecisionInput): Promise<void> {
    const result = await this.customers.updateOne(
      { _id: customerId },
      { $set: customerUpdateFor(input) },
      { session: input.session },
    );

    if (result.matchedCount === 0) {
      throw new NotFoundError('Customer', customerId);
    }
  }
}

function customerUpdateFor(input: ApplyDecisionInput): Record<string, unknown> {
  const outcome = input.decision.outcome as KycDecisionRequest['outcome'];
  const base: Record<string, unknown> = {
    kycStatus: STATUS_BY_OUTCOME[outcome],
    ...(input.riskRating === null ? {} : { riskRating: input.riskRating }),
  };

  if (outcome !== 'approved') {
    return base;
  }

  return {
    ...base,
    kycLevel: input.decision.grantedLevel,
    kycVerifiedAt: input.now,
    kycNextReviewAt: addOneYear(input.now),
  };
}

/** Periodic review: every approval books the next one a year out. */
function addOneYear(from: Date): Date {
  const next = new Date(from.getTime());
  next.setUTCFullYear(next.getUTCFullYear() + 1);
  return next;
}

function grantedLevelFor(request: KycDecisionRequest, existing: KycCaseDoc): KycLevel | null {
  if (request.outcome !== 'approved') {
    return null;
  }
  // Staff may grant a lower tier than the one applied for; the evidence supports what it supports.
  return request.grantedLevel ?? (existing.requestedLevel as KycLevel);
}

function assertDecidable(row: KycCaseDoc): void {
  if (row.decision != null) {
    throw new ConflictError('This KYC case has already been decided', {
      caseId: row._id,
      status: row.status,
    });
  }
  if (row.status !== 'pending_review') {
    throw new ConflictError('Only a submitted KYC case can be decided', {
      caseId: row._id,
      status: row.status,
    });
  }
}
