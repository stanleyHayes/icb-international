import type { Money } from '@icb/money';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { newId } from '../../infrastructure/database/identifier.js';
import { isDuplicateKeyError } from '../../infrastructure/database/mongo-errors.js';
import { TransactionManager } from '../../infrastructure/database/transaction.manager.js';
import { FeeChargeDoc } from '../../simulation/eod/infrastructure/eod.schemas.js';
import { SYSTEM_ACTOR, type FeeCode } from './accruals.constants.js';
import { customerRef, glRef } from '../ledger/domain/account-ref.js';
import { LedgerService } from '../ledger/ledger.service.js';
import type { AccountDoc } from '../accounts/infrastructure/account.schemas.js';

/** What one attempted charge produced. */
export type ChargeOutcome = 'posted' | 'waived' | 'duplicate';

export interface FeeChargeInput {
  readonly account: AccountDoc;
  readonly code: FeeCode;
  /** Claim key segment: `YYYY-MM` for cycle fees, `YYYY-MM-DD` for daily fees. */
  readonly period: string;
  readonly fee: Money;
  /** Set when a waiver rule fired — the charge is recorded, not taken. */
  readonly waivedReason: string | null;
  readonly description: string;
  /** The revenue account the fee credits (fee income, or FX income for conversion fees). */
  readonly incomeGlCode: string;
  readonly valueDate: string;
  readonly asOf: Date;
}

/**
 * The claim-then-post half of every fee the engine assesses.
 *
 * A fee is claimed by inserting a row into `fee_charges`, guarded by the unique index on
 * `(accountId, period, code)`. The claim and the posting commit in one database transaction,
 * so a re-run — a replayed job, a second EOD pass — loses the race against the index and
 * charges nothing twice. A check-then-write would let two runs both see "not charged yet".
 *
 * Waived fees still write their row: the bank can show the customer what they were spared,
 * and the index still blocks a second assessment for the same period.
 */
@Injectable()
export class FeeChargeService {
  constructor(
    @InjectModel(FeeChargeDoc.name) private readonly charges: Model<FeeChargeDoc>,
    private readonly ledger: LedgerService,
    private readonly transactionManager: TransactionManager,
  ) {}

  async charge(input: FeeChargeInput): Promise<ChargeOutcome> {
    try {
      return await this.transactionManager.withTransaction((session) =>
        this.claimAndPost(input, session),
      );
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        return 'duplicate';
      }
      throw error;
    }
  }

  private async claimAndPost(input: FeeChargeInput, session: ClientSession): Promise<ChargeOutcome> {
    const chargeId = newId();

    await this.charges.create(
      [
        {
          _id: chargeId,
          accountId: input.account._id,
          period: input.period,
          code: input.code,
          minorUnits: input.fee.minorUnits,
          currency: input.fee.currency,
          postedTransactionId: null,
          waivedReason: input.waivedReason,
          createdAt: input.asOf,
        },
      ],
      { session, ordered: true },
    );

    if (input.waivedReason !== null) {
      return 'waived';
    }

    const transactionId = await this.postFee(chargeId, input, session);
    await this.charges.updateOne(
      { _id: chargeId },
      { $set: { postedTransactionId: transactionId } },
      { session },
    );
    return 'posted';
  }

  /** Customer liability down, fee income up, in the claim's own session. */
  private async postFee(
    chargeId: string,
    input: FeeChargeInput,
    session: ClientSession,
  ): Promise<string> {
    const posted = await this.ledger.postWithin(
      {
        type: 'fee',
        description: input.description,
        actor: SYSTEM_ACTOR,
        valueDate: input.valueDate,
        sourceType: 'fee_charge',
        sourceId: chargeId,
        lines: [
          {
            accountRef: customerRef(input.account._id),
            direction: 'debit',
            amount: input.fee,
            narrative: input.code,
          },
          {
            accountRef: glRef(input.incomeGlCode),
            direction: 'credit',
            amount: input.fee,
            narrative: input.description,
          },
        ],
      },
      session,
    );
    return posted.id;
  }
}
