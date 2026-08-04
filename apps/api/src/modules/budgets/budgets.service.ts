import type { MoneyDto, TransactionCategory } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ClockService } from '../../simulation/clock/clock.service.js';
import { toMoneyDto } from '../accounts/infrastructure/account.mapper.js';
import { TransactionAnalyticsService } from '../transactions/analytics.service.js';
import { evaluateBudget, type BudgetStatus } from './domain/budget.js';
import { BudgetDoc } from './infrastructure/budget.schemas.js';

/** One budget line as the wire sees it: the limit, the month's actuals, and the verdict. */
export interface BudgetLine {
  category: TransactionCategory;
  limit: MoneyDto;
  spent: MoneyDto;
  status: BudgetStatus;
}

/** The full budget surface for the current calendar month. */
export interface BudgetsOverview {
  /** The calendar month the spend figures cover, e.g. `2026-08`. */
  month: string;
  budgets: BudgetLine[];
}

/** A single budget the customer sets via PUT. */
export interface BudgetInput {
  category: TransactionCategory;
  limit: MoneyDto;
}

/**
 * Category budgets.
 *
 * The limit is the only thing stored. Actuals are read from the ledger — through the same
 * analytics service the insights endpoints use — on every request, so the verdict is always
 * against the current simulated month and can never drift from the transaction feed. The
 * "alert" is therefore evaluated on read rather than pushed: the GET is the hook.
 */
@Injectable()
export class BudgetsService {
  constructor(
    @InjectModel(BudgetDoc.name) private readonly budgets: Model<BudgetDoc>,
    private readonly analytics: TransactionAnalyticsService,
    private readonly clock: ClockService,
  ) {}

  /** Every budget with the current month's spend and status folded in. */
  async overview(customerId: string): Promise<BudgetsOverview> {
    const docs = await this.budgets.find({ customerId }).lean();
    const window = this.currentMonthWindow();
    const lines: BudgetLine[] = [];
    for (const doc of docs) {
      lines.push(await this.toLine(customerId, doc, window));
    }
    return { month: window.from.slice(0, 7), budgets: lines };
  }

  /** Replaces the whole set — PUT semantics, so a retry converges to the same state. */
  async replace(customerId: string, inputs: readonly BudgetInput[]): Promise<BudgetsOverview> {
    const keep = new Set(inputs.map((input) => input.category));
    await this.budgets.deleteMany({ customerId, category: { $nin: [...keep] } });
    for (const input of inputs) {
      await this.budgets.updateOne(
        { customerId, category: input.category },
        {
          $set: { currency: input.limit.currency, limitMinorUnits: input.limit.minorUnits },
          $setOnInsert: { customerId, category: input.category },
        },
        { upsert: true },
      );
    }
    return this.overview(customerId);
  }

  private async toLine(
    customerId: string,
    doc: BudgetDoc,
    window: { from: string; to: string },
  ): Promise<BudgetLine> {
    const spend = await this.analytics.spendByCategory(customerId, { currency: doc.currency, ...window });
    const spentMinorUnits =
      spend.categories.find((row) => row.category === doc.category)?.amount.minorUnits ?? 0;
    return {
      category: doc.category as TransactionCategory,
      limit: toMoneyDto(doc.limitMinorUnits, doc.currency),
      spent: toMoneyDto(spentMinorUnits, doc.currency),
      status: evaluateBudget(doc.limitMinorUnits, spentMinorUnits),
    };
  }

  /** ISO-date bounds of the simulated calendar month (N8: never wall time). */
  private currentMonthWindow(): { from: string; to: string } {
    const bounds = this.clock.monthBounds(this.clock.now());
    return { from: this.clock.toIsoDate(bounds.from), to: this.clock.toIsoDate(bounds.to) };
  }
}
