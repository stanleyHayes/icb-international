import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';
import { AccountDoc } from '../../../modules/accounts/infrastructure/account.schemas.js';
import { customerRef } from '../../../modules/ledger/domain/account-ref.js';
import { LedgerEntryDoc } from '../../../modules/ledger/infrastructure/ledger.schemas.js';
import { isFirstOfMonth, type EodContext } from '../eod.context.js';
import { ExternalCollections } from '../infrastructure/external-collections.js';
import { previousPeriod, type StatementPeriod } from './statement-period.js';

interface Movement {
  _id: string;
  net: number;
  debits: number;
  credits: number;
  entries: number;
}

/**
 * Step 7 — generate month-end statements.
 *
 * Derived from ledger entries and nothing else, which is the only way opening + turnover =
 * closing can be guaranteed rather than hoped for. A statement assembled from a cached balance
 * and a list of transactions will eventually disagree with itself, and the customer will be the
 * one who notices.
 *
 * Runs on the first of the month for the month just ended. Re-running rewrites the same document
 * for the same `(accountId, period)` instead of producing a second one.
 */
@Injectable()
export class StatementGenerationStep {
  private readonly logger = new Logger(StatementGenerationStep.name);

  constructor(
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    @InjectModel(LedgerEntryDoc.name) private readonly entries: Model<LedgerEntryDoc>,
    private readonly external: ExternalCollections,
  ) {}

  async run(context: EodContext): Promise<number> {
    if (!isFirstOfMonth(context.businessDate)) {
      return 0;
    }

    const period = previousPeriod(context.businessDate);
    const accounts = await this.accounts.find({ status: { $ne: 'closed' } }).sort({ _id: 1 }).lean();
    const [openings, movements] = await Promise.all([
      this.openingBalances(period),
      this.movements(period),
    ]);

    let generated = 0;
    for (const account of accounts) {
      generated += await this.write(account, period, openings, movements, context);
    }

    this.logger.log({ period: period.label, generated }, 'Statements generated');
    return generated;
  }

  /** Everything posted before the period opened, per account. */
  private async openingBalances(period: StatementPeriod): Promise<Map<string, number>> {
    const rows = await this.entries.aggregate<{ _id: string; net: number }>([
      { $match: { accountRef: { $regex: '^acct:' }, valueDate: { $lt: period.from } } },
      { $group: { _id: '$accountRef', net: { $sum: '$signedMinorUnits' } } },
    ]);
    return new Map(rows.map((row) => [row._id, row.net]));
  }

  /** Turnover inside the period, split by direction so the statement can show both. */
  private async movements(period: StatementPeriod): Promise<Map<string, Movement>> {
    const rows = await this.entries.aggregate<Movement>([
      {
        $match: {
          accountRef: { $regex: '^acct:' },
          valueDate: { $gte: period.from, $lte: period.to },
        },
      },
      {
        $group: {
          _id: '$accountRef',
          net: { $sum: '$signedMinorUnits' },
          debits: {
            $sum: { $cond: [{ $eq: ['$direction', 'debit'] }, '$minorUnits', 0] },
          },
          credits: {
            $sum: { $cond: [{ $eq: ['$direction', 'credit'] }, '$minorUnits', 0] },
          },
          entries: { $sum: 1 },
        },
      },
    ]);
    return new Map(rows.map((row) => [row._id, row]));
  }

  /** Upsert on `(accountId, period)`. Returns 1 only when a statement did not already exist. */
  private async write(
    account: AccountDoc,
    period: StatementPeriod,
    openings: Map<string, number>,
    movements: Map<string, Movement>,
    context: EodContext,
  ): Promise<number> {
    const ref = customerRef(account._id);
    const opening = openings.get(ref) ?? 0;
    const movement = movements.get(ref) ?? emptyMovement(ref);

    const result = await this.external.statements().updateOne(
      { accountId: account._id, period: period.label },
      {
        $set: {
          openingBalanceMinorUnits: opening,
          closingBalanceMinorUnits: opening + movement.net,
          debitTurnoverMinorUnits: movement.debits,
          creditTurnoverMinorUnits: movement.credits,
          entryCount: movement.entries,
          currency: account.currency,
          generatedAt: context.asOf,
        },
        $setOnInsert: { _id: newId(), fileKey: null },
      },
      { upsert: true },
    );

    return result.upsertedCount > 0 ? 1 : 0;
  }
}

/** An account with no activity still gets a statement: the absence of movement is information. */
function emptyMovement(ref: string): Movement {
  return { _id: ref, net: 0, debits: 0, credits: 0, entries: 0 };
}
