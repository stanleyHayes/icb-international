import type { EndOfDayReport, LedgerIntegrityReport } from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { toMoneyDto } from '../../modules/accounts/infrastructure/account.mapper.js';
import { MetricsService } from '../../common/observability/metrics.service.js';
import { glRef } from '../../modules/ledger/domain/account-ref.js';
import { GL_SUSPENSE } from '../../modules/ledger/domain/chart-of-accounts.js';
import { AccountBalanceDoc } from '../../modules/ledger/infrastructure/ledger.schemas.js';
import { LedgerIntegrityService } from '../../modules/ledger/ledger-integrity.service.js';
import { ClockService } from '../clock/clock.service.js';
import type { EodContext } from './eod.context.js';
import { RecordSteps, ValueSteps } from './eod.steps.js';
import { EodReportStore } from './infrastructure/eod-report.store.js';

/** What one run produced, plus a process exit code for the CLI that wraps it. */
export interface EndOfDayOutcome {
  readonly report: EndOfDayReport;
  readonly integrity: LedgerIntegrityReport;
  /** Zero when the books balanced and suspense was clear; non-zero otherwise. */
  readonly exitCode: number;
}

interface StepTotals {
  holdsExpired: number;
  transfersSettled: number;
  interestAccrued: ReturnType<typeof toMoneyDto>;
  feesCharged: ReturnType<typeof toMoneyDto>;
  loansAged: number;
  amlAlertsRaised: number;
  statementsGenerated: number;
}

/**
 * The end-of-day pipeline.
 *
 * Ordered, re-runnable, and keyed by business date. The order is not a preference:
 *
 *  1. expire holds      — later steps read available balances, which stale holds distort
 *  2. settle due rails  — money in flight lands before anything is measured against it
 *  3. accrue interest   — on the balance the customer actually held at close
 *  4. assess fees       — after interest, so a fee never reverses an accrual on the same day
 *  5. age arrears       — servicing state catches up with the calendar
 *  6. monitor AML       — over the day's completed activity, not a partial view of it
 *  7. statements        — derived from a ledger that is now final for the period
 *  8. verify integrity  — assert the six invariants
 *  9. assert suspense   — GL 9900 must be flat; anything left there is unexplained money
 *
 * A failed integrity check does not throw. Throwing would discard the report — the one artefact
 * that says *what* the run did before the books stopped balancing — so the failure is recorded,
 * logged at error, and returned with a non-zero exit code for whatever is driving the run.
 */
@Injectable()
export class EndOfDayService {
  private readonly logger = new Logger(EndOfDayService.name);

  // eslint-disable-next-line max-params -- every collaborator is load-bearing; a bag of unrelated infrastructure would satisfy the count and hurt the reading.
  constructor(
    private readonly value: ValueSteps,
    private readonly records: RecordSteps,
    private readonly integrity: LedgerIntegrityService,
    @InjectModel(AccountBalanceDoc.name) private readonly balances: Model<AccountBalanceDoc>,
    private readonly store: EodReportStore,
    private readonly clock: ClockService,
    private readonly metrics: MetricsService,
  ) {}

  async run(businessDate?: string): Promise<EndOfDayOutcome> {
    const startedAt = this.clock.epochMs();
    const context: EodContext = {
      businessDate: businessDate ?? this.clock.today(),
      asOf: this.clock.now(),
    };

    this.logger.log({ businessDate: context.businessDate }, 'End of day started');

    // Observed even when a step throws: a failed run's duration is exactly the signal an
    // operator needs, and `finally` records it without swallowing the error.
    let balanced = false;
    try {
      const totals = await this.runSteps(context);
      const integrity = await this.integrity.verify();
      const suspenseZeroed = await this.isSuspenseFlat();

      const report: EndOfDayReport = {
        businessDate: context.businessDate,
        ...totals,
        ledgerBalanced: integrity.balanced,
        suspenseZeroed,
        durationMs: this.clock.epochMs() - startedAt,
        completedAt: this.clock.now().toISOString(),
      };

      await this.store.save(report);
      this.report(report, integrity);

      balanced = report.ledgerBalanced && suspenseZeroed;
      return { report, integrity, exitCode: balanced ? 0 : 1 };
    } finally {
      this.metrics.endOfDayRun(this.clock.epochMs() - startedAt, balanced);
    }
  }

  /** The ordered pipeline. Each step is idempotent, so the whole sequence is. */
  private async runSteps(context: EodContext): Promise<StepTotals> {
    const holdsExpired = await this.value.holds.run(context);
    const transfersSettled = await this.value.settlement.run(context);
    const interest = await this.value.interest.run(context);
    const fees = await this.value.fees.run(context);
    const loansAged = await this.records.arrears.run(context);
    const amlAlertsRaised = await this.records.aml.run(context);
    const statementsGenerated = await this.records.statements.run(context);

    const currency = this.store.currency;
    return {
      holdsExpired,
      transfersSettled,
      interestAccrued: toMoneyDto(interest.toMoney(currency).minorUnits, currency),
      feesCharged: toMoneyDto(fees.toMoney(currency).minorUnits, currency),
      loansAged,
      amlAlertsRaised,
      statementsGenerated,
    };
  }

  /**
   * Suspense (GL 9900) must be zero in every currency once the day is closed. A non-zero balance
   * means value is sitting somewhere nobody has claimed — the single most important thing to
   * notice at end of day, and the reason it is asserted separately from the integrity check.
   */
  private async isSuspenseFlat(): Promise<boolean> {
    const rows = await this.balances.find({ accountRef: glRef(GL_SUSPENSE) }).lean();
    return rows.every((row) => row.ledgerMinorUnits === 0);
  }

  private report(report: EndOfDayReport, integrity: LedgerIntegrityReport): void {
    if (report.ledgerBalanced && report.suspenseZeroed) {
      this.logger.log(report, 'End of day complete');
      return;
    }
    this.logger.error(
      { report, failed: integrity.checks.filter((check) => !check.passed) },
      'End of day completed with a FAILED ledger integrity check',
    );
  }

  /** A previously closed date, for the control room. */
  async reportFor(businessDate: string): Promise<EndOfDayReport | null> {
    return this.store.find(businessDate);
  }

  async history(limit?: number): Promise<EndOfDayReport[]> {
    return this.store.list(limit);
  }
}
