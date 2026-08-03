import { fromMinorUnits, isCurrencyCode, type CurrencyCode } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { Connection, Model } from 'mongoose';

import { AccountDoc } from '../accounts/infrastructure/account.schemas.js';
import { GL_FEE_INCOME, GL_FX_INCOME } from '../ledger/domain/chart-of-accounts.js';
import { FEE_CODES, type FeeCode } from './accruals.constants.js';
import { isStatementDate, statementCycle } from './domain/capitalisation.js';
import {
  fxFeeMinorUnits,
  lateFeeMinorUnits,
  transactionFeeMinorUnits,
} from './domain/fee-schedule.js';
import { waiverReason, type WaiverContext } from './domain/waivers.js';
import { FeeChargeService } from './fee-charge.service.js';
import { PeriodActivityService } from './period-activity.service.js';

export interface FeeAssessmentSummary {
  readonly accountsDue: number;
  readonly chargesAttempted: number;
  readonly posted: number;
  readonly waived: number;
  readonly duplicates: number;
}

interface CustomerRow {
  readonly _id: string;
  readonly tier?: string;
}

interface FeeAttempt {
  readonly code: FeeCode;
  readonly minorUnits: number;
  readonly description: string;
  readonly incomeGlCode: string;
}

/** One attempt, or none when the fee priced to zero — zero-amount fees are never claimed. */
function feeAttempt(
  code: FeeCode,
  minorUnits: number,
  description: string,
  incomeGlCode: string = GL_FEE_INCOME,
): FeeAttempt[] {
  return minorUnits > 0 ? [{ code, minorUnits, description, incomeGlCode }] : [];
}

/**
 * The periodic fee assessment, run on each account's own statement date.
 *
 * Four fee types are measured over the statement cycle just ended — monthly maintenance,
 * per-item transaction fees beyond the free allowance, the FX service fee on conversion
 * volume, and late fees on overdue loan instalments — each claimed in `fee_charges` under the
 * unique `(accountId, period, code)` index, so a replayed run charges nothing twice.
 *
 * Charging on the statement day, rather than the first of the month, means the charge lands
 * with the statement that reports it. Waived fees are recorded with their reason; they are
 * income the bank chose to give up, not income it lost track of.
 */
@Injectable()
export class FeeAssessmentService {
  private readonly logger = new Logger(FeeAssessmentService.name);

  constructor(
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    @InjectConnection() private readonly connection: Connection,
    private readonly activity: PeriodActivityService,
    private readonly feeCharges: FeeChargeService,
  ) {}

  async run(businessDate: string, asOf: Date): Promise<FeeAssessmentSummary> {
    const accounts = await this.accounts.find({ status: 'active' }).sort({ _id: 1 }).lean();
    const due = accounts.filter((account) => isStatementDate(businessDate, account.statementDay));

    const summary = { accountsDue: due.length, chargesAttempted: 0, posted: 0, waived: 0, duplicates: 0 };
    for (const account of due) {
      const outcomes = await this.assessAccount(account, businessDate, asOf);
      for (const outcome of outcomes) {
        summary.chargesAttempted += 1;
        if (outcome === 'posted') summary.posted += 1;
        if (outcome === 'waived') summary.waived += 1;
        if (outcome === 'duplicate') summary.duplicates += 1;
      }
    }

    if (due.length > 0) {
      this.logger.log({ businessDate, ...summary }, 'Periodic fees assessed');
    }
    return summary;
  }

  private async assessAccount(
    account: AccountDoc,
    businessDate: string,
    asOf: Date,
  ): Promise<('posted' | 'waived' | 'duplicate')[]> {
    if (!isCurrencyCode(account.currency)) {
      return [];
    }
    const currency: CurrencyCode = account.currency;
    const context = await this.waiverContext(account, currency);
    const period = businessDate.slice(0, 7);
    const outcomes: ('posted' | 'waived' | 'duplicate')[] = [];

    for (const attempt of await this.assessFees(account, currency, businessDate)) {
      outcomes.push(
        await this.feeCharges.charge({
          account,
          code: attempt.code,
          period,
          fee: fromMinorUnits(attempt.minorUnits, currency),
          waivedReason: waiverReason(attempt.code, attempt.minorUnits, context),
          description: attempt.description,
          incomeGlCode: attempt.incomeGlCode,
          valueDate: businessDate,
          asOf,
        }),
      );
    }
    return outcomes;
  }

  /** Price each fee type against the cycle's measured activity. Zero-amount fees are skipped. */
  private async assessFees(
    account: AccountDoc,
    currency: CurrencyCode,
    businessDate: string,
  ): Promise<FeeAttempt[]> {
    const cycle = statementCycle(businessDate, account.statementDay);
    const attempts: FeeAttempt[] = [];

    const maintenance = account.monthlyFeeMinorUnits ?? 0;
    if (maintenance > 0) {
      attempts.push({
        code: FEE_CODES.maintenance,
        minorUnits: maintenance,
        description: `Account maintenance fee — ${businessDate.slice(0, 7)}`,
        incomeGlCode: GL_FEE_INCOME,
      });
    }

    attempts.push(...await this.activityFees(account._id, currency, cycle, businessDate));
    return attempts;
  }

  private async activityFees(
    accountId: string,
    currency: CurrencyCode,
    cycle: { fromExclusive: string; toInclusive: string },
    businessDate: string,
  ): Promise<FeeAttempt[]> {
    const period = businessDate.slice(0, 7);
    const attempts: FeeAttempt[] = [];

    const transaction = transactionFeeMinorUnits(
      await this.activity.chargeableDebitCount(accountId, cycle),
      currency,
    );
    attempts.push(...feeAttempt(FEE_CODES.transaction, transaction, `Transaction fees — ${period}`));

    const fx = fxFeeMinorUnits(await this.activity.fxVolumeMinorUnits(accountId, cycle));
    attempts.push(...feeAttempt(FEE_CODES.fx, fx, `FX service fee — ${period}`, GL_FX_INCOME));

    const late = lateFeeMinorUnits(
      await this.activity.overdueInstalmentCount(accountId, businessDate),
      currency,
    );
    attempts.push(...feeAttempt(FEE_CODES.late, late, `Late payment fee — ${period}`));
    return attempts;
  }

  private async waiverContext(account: AccountDoc, currency: CurrencyCode): Promise<WaiverContext> {
    const customer = await this.connection
      .collection<CustomerRow>('customers')
      .findOne({ _id: account.customerId }, { projection: { tier: 1 } });
    const balance = await this.activity.balanceContext(account._id, currency);

    return {
      customerTier: customer?.tier ?? null,
      balanceMinorUnits: balance.ledgerMinorUnits,
      minimumBalanceMinorUnits: account.minimumBalanceMinorUnits,
      availableMinorUnits: balance.availableMinorUnits,
    };
  }
}
