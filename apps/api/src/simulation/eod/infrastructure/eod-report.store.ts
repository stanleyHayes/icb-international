import type { EndOfDayReport } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import { newId } from '../../../infrastructure/database/identifier.js';
import { toMoneyDto } from '../../../modules/accounts/infrastructure/account.mapper.js';
import { reportingCurrency } from '../eod.context.js';
import { EodReportDoc } from './eod.schemas.js';

/**
 * Storage for end-of-day reports, keyed by the business date they close.
 *
 * A re-run overwrites rather than appends, and `runCount` records how many times the date was
 * closed — an operator who sees `runCount: 3` and unchanged figures has direct evidence that the
 * pipeline really is idempotent, which is more convincing than a test asserting it.
 */
@Injectable()
export class EodReportStore {
  /** The currency the report's aggregate money figures are stamped with. */
  readonly currency: CurrencyCode;

  constructor(
    @InjectModel(EodReportDoc.name) private readonly reports: Model<EodReportDoc>,
    @Inject(CONFIG) config: AppConfiguration,
  ) {
    this.currency = reportingCurrency(config.bank.baseCurrency);
  }

  async save(report: EndOfDayReport): Promise<void> {
    await this.reports.updateOne(
      { businessDate: report.businessDate },
      {
        $set: {
          holdsExpired: report.holdsExpired,
          transfersSettled: report.transfersSettled,
          interestAccruedMinorUnits: report.interestAccrued.minorUnits,
          feesChargedMinorUnits: report.feesCharged.minorUnits,
          currency: report.interestAccrued.currency,
          loansAged: report.loansAged,
          statementsGenerated: report.statementsGenerated,
          amlAlertsRaised: report.amlAlertsRaised,
          ledgerBalanced: report.ledgerBalanced,
          suspenseZeroed: report.suspenseZeroed,
          durationMs: report.durationMs,
          completedAt: new Date(report.completedAt),
        },
        $inc: { runCount: 1 },
        $setOnInsert: { _id: newId(), businessDate: report.businessDate },
      },
      { upsert: true },
    );
  }

  async find(businessDate: string): Promise<EndOfDayReport | null> {
    const document = await this.reports.findOne({ businessDate }).lean();
    return document ? toEndOfDayReport(document) : null;
  }

  /** Most recent first, for the control room's history panel. */
  async list(limit = 30): Promise<EndOfDayReport[]> {
    const documents = await this.reports.find().sort({ businessDate: -1 }).limit(limit).lean();
    return documents.map(toEndOfDayReport);
  }
}

export function toEndOfDayReport(document: EodReportDoc): EndOfDayReport {
  return {
    businessDate: document.businessDate,
    holdsExpired: document.holdsExpired,
    transfersSettled: document.transfersSettled,
    interestAccrued: toMoneyDto(document.interestAccruedMinorUnits, document.currency),
    feesCharged: toMoneyDto(document.feesChargedMinorUnits, document.currency),
    loansAged: document.loansAged,
    statementsGenerated: document.statementsGenerated,
    amlAlertsRaised: document.amlAlertsRaised,
    ledgerBalanced: document.ledgerBalanced,
    suspenseZeroed: document.suspenseZeroed,
    durationMs: document.durationMs,
    completedAt: document.completedAt.toISOString(),
  };
}
