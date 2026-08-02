import type { BeneficiaryVerification } from '@icb/contracts';
import { fromMinorUnits, isCurrencyCode, type CurrencyCode } from '@icb/money';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError } from '../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { newReference } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { customerRef, glRef } from '../ledger/domain/account-ref.js';
import { GL_FRAUD_LOSSES } from '../ledger/domain/chart-of-accounts.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { BeneficiariesService } from './beneficiaries.service.js';
import { MicroDepositLockedError, MicroDepositMismatchError } from './domain/beneficiary-errors.js';
import {
  MICRO_DEPOSIT_ATTEMPTS,
  generateMicroDeposits,
  hashMicroDeposits,
  microDepositsMatch,
  type MicroDepositAmounts,
} from './domain/micro-deposit.js';
import { VERIFICATION_STATES } from './domain/verification-state.js';
import { toBeneficiaryVerification } from './infrastructure/beneficiary.mapper.js';
import { BeneficiaryDoc } from './infrastructure/beneficiary.schemas.js';

const NARRATIVE = 'Beneficiary verification micro-deposit';

/**
 * Micro-deposit verification, simulated end to end but with the real flow.
 *
 * ICB credits two amounts under a pound to the destination; only somebody who can see that
 * account can read them back. That is what makes it a genuine control rather than a checkbox:
 * an attacker who added their own mule account can verify it, but an attacker who added a
 * *victim's* account — the reverse-fraud pattern — cannot.
 *
 * The deposits cost the bank money, so they are posted as an expense against fraud-and-dispute
 * losses (5100) rather than conjured from suspense.
 */
@Injectable()
export class BeneficiaryVerificationService {
  private readonly logger = new Logger(BeneficiaryVerificationService.name);

  constructor(
    @InjectModel(BeneficiaryDoc.name) private readonly beneficiaries: Model<BeneficiaryDoc>,
    private readonly payees: BeneficiariesService,
    private readonly ledger: LedgerService,
    private readonly clock: ClockService,
    @Inject(CONFIG) private readonly config: AppConfiguration,
  ) {}

  async status(customerId: string, beneficiaryId: string): Promise<BeneficiaryVerification> {
    return toBeneficiaryVerification(await this.payees.loadOwned(beneficiaryId, customerId));
  }

  /**
   * Send (or re-send) the two deposits.
   *
   * A re-send draws fresh amounts but never restores the attempt budget — otherwise the lock
   * would be trivially defeated by asking for new deposits after every second guess.
   */
  async sendMicroDeposits(
    customerId: string,
    beneficiaryId: string,
  ): Promise<BeneficiaryVerification> {
    const doc = await this.payees.loadOwned(beneficiaryId, customerId);
    this.assertVerifiable(doc);

    const sentAt = this.clock.now();
    const amounts = generateMicroDeposits(
      `${this.config.simulation.seed}:${beneficiaryId}:${sentAt.getTime()}`,
    );
    const transactionIds = await this.postDeposits(doc, amounts);

    const updated = await this.beneficiaries
      .findOneAndUpdate(
        { _id: beneficiaryId, customerId },
        {
          $set: {
            verificationState: VERIFICATION_STATES.DEPOSITS_SENT,
            verificationHash: hashMicroDeposits(this.hmacKey(), beneficiaryId, amounts),
            depositsSentAt: sentAt,
            microDepositTransactionIds: transactionIds,
          },
        },
        { new: true },
      )
      .lean();

    this.logger.log({ beneficiaryId, postings: transactionIds.length }, 'Micro-deposits sent');
    return toBeneficiaryVerification(updated ?? doc);
  }

  /** Both amounts, both correct, in one shot. A partial match is simply a wrong answer. */
  async confirm(
    customerId: string,
    beneficiaryId: string,
    amounts: MicroDepositAmounts,
  ): Promise<BeneficiaryVerification> {
    const doc = await this.payees.loadOwned(beneficiaryId, customerId);
    this.assertVerifiable(doc);

    if (doc.verificationState !== VERIFICATION_STATES.DEPOSITS_SENT) {
      throw new ConflictError('Ask for the micro-deposits before confirming them', {
        beneficiaryId,
      });
    }

    const candidate = hashMicroDeposits(this.hmacKey(), beneficiaryId, amounts);
    if (!microDepositsMatch(doc.verificationHash, candidate)) {
      return this.recordFailure(doc);
    }
    return this.recordSuccess(doc);
  }

  private assertVerifiable(doc: BeneficiaryDoc): void {
    if (doc.verified) {
      throw new ConflictError('This payee is already verified', { beneficiaryId: doc._id });
    }
    if (
      doc.verificationState === VERIFICATION_STATES.LOCKED ||
      doc.verificationAttemptsRemaining <= 0
    ) {
      throw new MicroDepositLockedError(doc._id);
    }
  }

  private async recordSuccess(doc: BeneficiaryDoc): Promise<BeneficiaryVerification> {
    const verifiedAt = this.clock.now();
    // The digest is dropped on success: keeping it would preserve a guessable secret forever.
    const updated = await this.beneficiaries
      .findOneAndUpdate(
        { _id: doc._id },
        {
          $set: {
            verified: true,
            verificationState: VERIFICATION_STATES.VERIFIED,
            verifiedAt,
            verificationHash: null,
          },
        },
        { new: true },
      )
      .lean();

    this.logger.log({ beneficiaryId: doc._id }, 'Beneficiary verified');
    return toBeneficiaryVerification(updated ?? doc);
  }

  /** Three wrong answers and the payee is locked; only a support action reopens it. */
  private async recordFailure(doc: BeneficiaryDoc): Promise<never> {
    const remaining = Math.max(0, doc.verificationAttemptsRemaining - 1);
    const locked = remaining === 0;

    await this.beneficiaries.updateOne(
      { _id: doc._id },
      {
        $set: {
          verificationAttemptsRemaining: remaining,
          verificationState: locked ? VERIFICATION_STATES.LOCKED : VERIFICATION_STATES.FAILED,
          ...(locked ? { verificationHash: null } : {}),
        },
      },
    );

    this.logger.warn({ beneficiaryId: doc._id, remaining, locked }, 'Micro-deposit mismatch');
    if (locked) {
      throw new MicroDepositLockedError(doc._id);
    }
    throw new MicroDepositMismatchError(doc._id, remaining);
  }

  /**
   * Two credits, posted separately so they appear on the statement the way real micro-deposits
   * do. An external destination gets no posting — ICB cannot credit an account it does not hold —
   * but the expected amounts are still recorded, so the flow is identical from the customer's
   * side.
   */
  private async postDeposits(
    doc: BeneficiaryDoc,
    amounts: MicroDepositAmounts,
  ): Promise<string[]> {
    const accountId = doc.icbAccountId;
    if (!accountId || !isCurrencyCode(doc.currency)) {
      return [];
    }

    const first = await this.postOne(doc, accountId, doc.currency, amounts.first);
    const second = await this.postOne(doc, accountId, doc.currency, amounts.second);
    return [first, second];
  }

  private async postOne(
    doc: BeneficiaryDoc,
    accountId: string,
    currency: CurrencyCode,
    minorUnits: number,
  ): Promise<string> {
    const amount = fromMinorUnits(minorUnits, currency);
    const posted = await this.ledger.post({
      type: 'deposit',
      description: `${NARRATIVE} for ${doc.displayIdentifier}`,
      actor: { kind: 'system', id: null, label: 'beneficiary-verification' },
      lines: [
        { accountRef: glRef(GL_FRAUD_LOSSES), direction: 'debit', amount, narrative: NARRATIVE },
        { accountRef: customerRef(accountId), direction: 'credit', amount, narrative: NARRATIVE },
      ],
      reference: newReference('MDP'),
      sourceType: 'beneficiary_verification',
      sourceId: doc._id,
    });
    return posted.id;
  }

  private hmacKey(): string {
    return this.config.crypto.fieldEncryptionKey;
  }

  /** Exposed so a seed or a support tool can reason about the budget without re-deriving it. */
  static get maximumAttempts(): number {
    return MICRO_DEPOSIT_ATTEMPTS;
  }
}
