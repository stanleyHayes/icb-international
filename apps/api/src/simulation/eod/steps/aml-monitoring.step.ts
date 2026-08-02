import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';
import { AccountDoc } from '../../../modules/accounts/infrastructure/account.schemas.js';
import { accountIdFromRef, toAccountRef } from '../../../modules/ledger/domain/account-ref.js';
import { LedgerEntryDoc } from '../../../modules/ledger/infrastructure/ledger.schemas.js';
import type { EodContext } from '../eod.context.js';
import { ExternalCollections } from '../infrastructure/external-collections.js';

/** Reporting threshold, in minor units. Ten thousand units of the account's own currency. */
const LARGE_VALUE_THRESHOLD = 1_000_000;
/** Deposits split to stay under the threshold are the classic evasion pattern. */
const STRUCTURING_MIN_CREDITS = 3;
const BATCH_SOURCE = 'end-of-day';

interface DayCredits {
  _id: { ref: string; currency: string };
  total: number;
  largest: number;
  count: number;
}

/**
 * Step 6 — monitor for AML patterns.
 *
 * Two rules, both of which a real monitoring system starts with: a single credit at or above the
 * reporting threshold, and a set of credits that individually stay under it but together clear it
 * on the same day. The second is the one that matters — a customer who deposits just under the
 * limit three times before lunch is telling you something the first rule never sees.
 *
 * Alerts are raised, never auto-closed. Idempotent per (account, date, rule): a re-run recognises
 * its own alerts and adds nothing.
 */
@Injectable()
export class AmlMonitoringStep {
  private readonly logger = new Logger(AmlMonitoringStep.name);

  constructor(
    @InjectModel(LedgerEntryDoc.name) private readonly entries: Model<LedgerEntryDoc>,
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    private readonly external: ExternalCollections,
  ) {}

  async run(context: EodContext): Promise<number> {
    const credits = await this.creditsForDay(context.businessDate);

    let raised = 0;
    for (const row of credits) {
      const kind = classify(row);
      if (kind) {
        raised += await this.raise(row, kind, context);
      }
    }

    if (raised > 0) {
      this.logger.warn({ businessDate: context.businessDate, raised }, 'AML alerts raised');
    }
    return raised;
  }

  /** Every customer account credited today, with the shape of those credits. */
  private async creditsForDay(businessDate: string): Promise<DayCredits[]> {
    return this.entries.aggregate<DayCredits>([
      {
        $match: {
          valueDate: businessDate,
          direction: 'credit',
          accountRef: { $regex: '^acct:' },
        },
      },
      {
        $group: {
          _id: { ref: '$accountRef', currency: '$currency' },
          total: { $sum: '$minorUnits' },
          largest: { $max: '$minorUnits' },
          count: { $sum: 1 },
        },
      },
    ]);
  }

  /** Write the alert unless this run — or an earlier one for the same day — already did. */
  private async raise(row: DayCredits, kind: string, context: EodContext): Promise<number> {
    const alerts = this.external.amlAlerts();
    const existing = await alerts.findOne({
      source: BATCH_SOURCE,
      businessDate: context.businessDate,
      subjectRef: row._id.ref,
      kind,
    });

    if (existing) {
      return 0;
    }

    const accountId = accountIdFromRef(toAccountRef(row._id.ref));
    const account = await this.accounts.findById(accountId).lean();

    await alerts.insertOne({
      _id: newId(),
      customerId: account?.customerId ?? 'unknown',
      subjectRef: row._id.ref,
      kind,
      severity: kind === 'large_value' ? 'high' : 'medium',
      status: 'open',
      narrative: narrativeFor(row, kind),
      assignedTo: null,
      source: BATCH_SOURCE,
      businessDate: context.businessDate,
      createdAt: context.asOf,
    });
    return 1;
  }
}

function classify(row: DayCredits): string | null {
  if (row.largest >= LARGE_VALUE_THRESHOLD) {
    return 'large_value';
  }
  if (row.count >= STRUCTURING_MIN_CREDITS && row.total >= LARGE_VALUE_THRESHOLD) {
    return 'structuring';
  }
  return null;
}

function narrativeFor(row: DayCredits, kind: string): string {
  const currency = row._id.currency;
  if (kind === 'large_value') {
    return `Single credit of ${row.largest} ${currency} minor units at or above the reporting threshold.`;
  }
  return `${row.count} credits totalling ${row.total} ${currency} minor units, each individually below the reporting threshold.`;
}
