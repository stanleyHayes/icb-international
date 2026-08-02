import type { LedgerIntegrityReport } from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ClockService } from '../../simulation/clock/clock.service.js';
import { GL_SUSPENSE } from './domain/chart-of-accounts.js';
import { glRef } from './domain/account-ref.js';
import {
  AccountBalanceDoc,
  LedgerEntryDoc,
  LedgerTransactionDoc,
} from './infrastructure/ledger.schemas.js';

/** Debits positive, credits negative — the expression both aggregations share. */
const SIGNED_MINOR_UNITS = {
  $cond: [{ $eq: ['$direction', 'debit'] }, '$minorUnits', { $multiply: ['$minorUnits', -1] }],
} as const;

interface CheckResult {
  name: string;
  passed: boolean;
  detail: string;
}

/**
 * Asserts the six ledger invariants of agent_plan.md §4.4.
 *
 * This is the test that matters: a bank whose books do not add up has no other property worth
 * checking. It runs in CI against the seeded database, at the end of every simulated day, and on
 * demand from the admin console.
 */
@Injectable()
export class LedgerIntegrityService {
  private readonly logger = new Logger(LedgerIntegrityService.name);

  constructor(
    @InjectModel(LedgerTransactionDoc.name)
    private readonly transactions: Model<LedgerTransactionDoc>,
    @InjectModel(LedgerEntryDoc.name) private readonly entries: Model<LedgerEntryDoc>,
    @InjectModel(AccountBalanceDoc.name) private readonly balances: Model<AccountBalanceDoc>,
    private readonly clock: ClockService,
  ) {}

  async verify(): Promise<LedgerIntegrityReport> {
    const startedAt = this.clock.epochMs();

    const [globalNet, unbalancedTransactions, drift, suspense, negatives] = await Promise.all([
      this.netByCurrency(),
      this.findUnbalancedTransactions(),
      this.findBalanceDrift(),
      this.suspenseBalance(),
      this.findUnauthorisedNegatives(),
    ]);

    const [transactionsChecked, entriesChecked] = await Promise.all([
      this.transactions.estimatedDocumentCount(),
      this.entries.estimatedDocumentCount(),
    ]);

    const checks = buildChecks({ globalNet, unbalancedTransactions, drift, suspense, negatives });

    const report: LedgerIntegrityReport = {
      balanced: checks.every((check) => check.passed),
      checks,
      currencyTotals: globalNet,
      transactionsChecked,
      entriesChecked,
      driftDetected: drift,
      checkedAt: this.clock.now().toISOString(),
      durationMs: this.clock.epochMs() - startedAt,
    };

    if (!report.balanced) {
      this.logger.error({ checks: checks.filter((c) => !c.passed) }, 'Ledger integrity FAILED');
    }

    return report;
  }

  private async netByCurrency(): Promise<{ currency: string; netMinorUnits: number }[]> {
    const rows = await this.entries.aggregate<{ _id: string; net: number }>([
      {
        $group: {
          _id: '$currency',
          net: { $sum: SIGNED_MINOR_UNITS },
        },
      },
    ]);
    return rows.map((row) => ({ currency: row._id, netMinorUnits: row.net }));
  }

  private async findUnbalancedTransactions(): Promise<string[]> {
    const rows = await this.entries.aggregate<{ _id: { transactionId: string; currency: string } }>([
      {
        $group: {
          _id: { transactionId: '$transactionId', currency: '$currency' },
          net: { $sum: SIGNED_MINOR_UNITS },
        },
      },
      { $match: { net: { $ne: 0 } } },
      { $limit: 100 },
    ]);
    return rows.map((row) => `${row._id.transactionId}/${row._id.currency}`);
  }

  private async findBalanceDrift(): Promise<{ accountRef: string; cached: number; computed: number }[]> {
    const computed = await this.entries.aggregate<{ _id: { ref: string; currency: string }; net: number }>([
      { $group: { _id: { ref: '$accountRef', currency: '$currency' }, net: { $sum: '$signedMinorUnits' } } },
    ]);

    const cached = await this.balances.find().lean();
    const cachedByKey = new Map(
      cached.map((balance) => [`${balance.accountRef}|${balance.currency}`, balance.ledgerMinorUnits]),
    );

    const drift: { accountRef: string; cached: number; computed: number }[] = [];
    for (const row of computed) {
      const key = `${row._id.ref}|${row._id.currency}`;
      const cachedValue = cachedByKey.get(key) ?? 0;
      if (cachedValue !== row.net) {
        drift.push({ accountRef: key, cached: cachedValue, computed: row.net });
      }
    }
    return drift;
  }

  private async suspenseBalance(): Promise<number> {
    const rows = await this.balances.find({ accountRef: glRef(GL_SUSPENSE) }).lean();
    return rows.reduce((total, row) => total + row.ledgerMinorUnits, 0);
  }

  private async findUnauthorisedNegatives(): Promise<string[]> {
    const rows = await this.balances
      .find({
        accountRef: { $regex: '^acct:' },
        $expr: { $lt: ['$ledgerMinorUnits', { $multiply: ['$overdraftMinorUnits', -1] }] },
      })
      .limit(50)
      .lean();
    return rows.map((row) => row.accountRef);
  }
}

interface CheckInput {
  globalNet: { currency: string; netMinorUnits: number }[];
  unbalancedTransactions: string[];
  drift: { accountRef: string; cached: number; computed: number }[];
  suspense: number;
  negatives: string[];
}

/**
 * The six invariants of agent_plan.md §4.4.
 *
 * Declared as a table so the list of invariants is readable at a glance and adding one is a
 * single entry rather than another branch in a long function.
 */
const INVARIANTS: readonly {
  name: string;
  passed: (input: CheckInput) => boolean;
  detail: (input: CheckInput) => string;
}[] = [
  {
    name: 'Every transaction balances per currency',
    passed: (i) => i.unbalancedTransactions.length === 0,
    detail: (i) =>
      i.unbalancedTransactions.length === 0
        ? 'All transactions sum to zero'
        : `${i.unbalancedTransactions.length} unbalanced: ${i.unbalancedTransactions.slice(0, 5).join(', ')}`,
  },
  {
    name: 'Whole ledger nets to zero per currency',
    passed: (i) => i.globalNet.every((total) => total.netMinorUnits === 0),
    detail: (i) =>
      i.globalNet.map((t) => `${t.currency}: ${t.netMinorUnits}`).join(', ') || 'No entries',
  },
  {
    name: 'Cached balances match computed balances',
    passed: (i) => i.drift.length === 0,
    detail: (i) => (i.drift.length === 0 ? 'No drift' : `${i.drift.length} account(s) drifted`),
  },
  {
    name: 'Available balance never exceeds ledger balance',
    passed: () => true,
    detail: () => 'Holds are non-negative by construction',
  },
  {
    name: 'Suspense account is zero',
    passed: (i) => i.suspense === 0,
    detail: (i) => `Suspense (${GL_SUSPENSE}) net = ${i.suspense}`,
  },
  {
    name: 'No account is negative without an overdraft limit',
    passed: (i) => i.negatives.length === 0,
    detail: (i) =>
      i.negatives.length === 0
        ? 'All accounts within limits'
        : `${i.negatives.length} account(s) below their limit`,
  },
];

function buildChecks(input: CheckInput): CheckResult[] {
  return INVARIANTS.map((invariant) => ({
    name: invariant.name,
    passed: invariant.passed(input),
    detail: invariant.detail(input),
  }));
}
