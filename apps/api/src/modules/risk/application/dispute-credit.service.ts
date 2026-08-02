import { fromMinorUnits, type CurrencyCode } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';

import { ConflictError } from '../../../common/errors/index.js';
import { newReference } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { customerRef, glRef } from '../../ledger/domain/account-ref.js';
import { GL_FRAUD_LOSSES } from '../../ledger/domain/chart-of-accounts.js';
import type { PostingActor } from '../../ledger/domain/posting.types.js';
import { LedgerService } from '../../ledger/ledger.service.js';
import type { DisputeDoc, ProvisionalCreditSub } from '../infrastructure/dispute.schemas.js';

/**
 * The money half of a dispute.
 *
 * Provisional credit is not a status flag — it is a posting. The bank takes the loss onto its own
 * fraud and dispute expense account (GL 5100) and credits the customer, so the balance sheet
 * carries the exposure from the moment the customer is made whole rather than at some later
 * reconciliation. If the dispute then fails, the credit is *reversed*, never deleted: both legs
 * stay on the statement, which is the only truthful account of what happened.
 */
@Injectable()
export class DisputeCreditService {
  private readonly logger = new Logger(DisputeCreditService.name);

  constructor(
    private readonly ledger: LedgerService,
    private readonly clock: ClockService,
  ) {}

  /** Debit fraud and dispute losses, credit the customer. Real value, moved immediately. */
  async grant(dispute: DisputeDoc, actor: PostingActor): Promise<ProvisionalCreditSub> {
    if (dispute.provisionalCredit && !dispute.provisionalCredit.clawedBackAt) {
      throw new ConflictError('Provisional credit has already been granted on this dispute', {
        disputeId: dispute._id,
      });
    }

    const amount = fromMinorUnits(dispute.amountMinorUnits, dispute.currency as CurrencyCode);
    const narrative = `Provisional credit — dispute ${dispute.reference}`;

    const posted = await this.ledger.post({
      type: 'adjustment',
      description: narrative,
      actor,
      lines: [
        { accountRef: glRef(GL_FRAUD_LOSSES), direction: 'debit', amount, narrative },
        { accountRef: customerRef(dispute.accountId), direction: 'credit', amount, narrative },
      ],
      reference: newReference('PCR'),
      sourceType: 'dispute',
      sourceId: dispute._id,
      metadata: { disputeReference: dispute.reference, reason: dispute.reason },
    });

    this.logger.log(
      { disputeId: dispute._id, transactionId: posted.id, minorUnits: amount.minorUnits },
      'Provisional credit granted',
    );

    return {
      minorUnits: dispute.amountMinorUnits,
      currency: dispute.currency,
      transactionId: posted.id,
      grantedAt: this.clock.now(),
      clawbackTransactionId: null,
      clawedBackAt: null,
    };
  }

  /**
   * Take the provisional credit back when the dispute fails.
   *
   * Posted as a ledger reversal of the original credit rather than a fresh opposite entry, so the
   * two are linked and the statement reads as one event with two legs.
   */
  async clawBack(
    dispute: DisputeDoc,
    reason: string,
    actor: PostingActor,
  ): Promise<ProvisionalCreditSub> {
    const credit = dispute.provisionalCredit;
    if (!credit) {
      throw new ConflictError('There is no provisional credit to claw back', {
        disputeId: dispute._id,
      });
    }
    if (credit.clawedBackAt) {
      return credit;
    }

    const reversal = await this.ledger.reverse(credit.transactionId, reason, actor);
    this.logger.log(
      { disputeId: dispute._id, transactionId: reversal.id },
      'Provisional credit clawed back',
    );

    return { ...credit, clawbackTransactionId: reversal.id, clawedBackAt: this.clock.now() };
  }
}
