import { fromMinorUnits, isCurrencyCode } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import type { Connection, Model } from 'mongoose';

import { AccountDoc } from '../accounts/infrastructure/account.schemas.js';
import { accountIdFromRef, toAccountRef } from '../ledger/domain/account-ref.js';
import { GL_FEE_INCOME } from '../ledger/domain/chart-of-accounts.js';
import { AccountBalanceDoc } from '../ledger/infrastructure/ledger.schemas.js';
import { FEE_CODES } from './accruals.constants.js';
import { overdraftFeeMinorUnits } from './domain/fee-schedule.js';
import { chargeableOverdraftBase, waiverReason } from './domain/waivers.js';
import { FeeChargeService, type ChargeOutcome } from './fee-charge.service.js';

export interface OverdraftFeeSummary {
  readonly accountsAssessed: number;
  readonly posted: number;
  readonly waived: number;
}

interface CustomerRow {
  readonly _id: string;
  readonly tier?: string;
}

/**
 * The daily overdraft charge.
 *
 * Overdraft interest accrues daily on arranged facilities only, ACT/360, capped at the
 * facility limit: an account overdrawn beyond its arrangement is a collections matter, not a
 * fee matter. The claim is keyed per calendar day (`period = YYYY-MM-DD`), so a replayed run
 * charges nothing twice and a day partially re-run completes rather than duplicates.
 *
 * The affordability waiver does not apply here — being overdrawn is the condition being
 * priced — but the contractual tier waiver does.
 */
@Injectable()
export class OverdraftFeeService {
  private readonly logger = new Logger(OverdraftFeeService.name);

  constructor(
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    @InjectModel(AccountBalanceDoc.name) private readonly balances: Model<AccountBalanceDoc>,
    @InjectConnection() private readonly connection: Connection,
    private readonly feeCharges: FeeChargeService,
  ) {}

  async run(businessDate: string, asOf: Date): Promise<OverdraftFeeSummary> {
    const overdrawn = await this.balances
      .find({ accountRef: /^acct:/, ledgerMinorUnits: { $lt: 0 } })
      .sort({ accountRef: 1 })
      .lean();

    let posted = 0;
    let waived = 0;
    for (const row of overdrawn) {
      const outcome = await this.assessOne(accountIdFromRef(toAccountRef(row.accountRef)), row, businessDate, asOf);
      if (outcome === 'posted') posted += 1;
      if (outcome === 'waived') waived += 1;
    }

    if (overdrawn.length > 0) {
      this.logger.log({ businessDate, assessed: overdrawn.length, posted, waived }, 'Overdraft fees assessed');
    }
    return { accountsAssessed: overdrawn.length, posted, waived };
  }

  private async assessOne(
    accountId: string,
    row: { ledgerMinorUnits: number },
    businessDate: string,
    asOf: Date,
  ): Promise<ChargeOutcome> {
    const account = await this.accounts.findById(accountId).lean();
    if (!account || account.status !== 'active' || !isCurrencyCode(account.currency)) {
      return 'duplicate';
    }

    const overdrawn = -row.ledgerMinorUnits;
    const base = chargeableOverdraftBase(overdrawn, account.overdraftMinorUnits);
    const feeMinorUnits = overdraftFeeMinorUnits(base, 1);
    const waivedReason = await this.resolveWaiver(account.customerId, base, feeMinorUnits);

    return this.feeCharges.charge({
      account,
      code: FEE_CODES.overdraft,
      period: businessDate,
      fee: fromMinorUnits(feeMinorUnits, account.currency),
      waivedReason,
      description: `Overdraft interest — ${businessDate}`,
      incomeGlCode: GL_FEE_INCOME,
      valueDate: businessDate,
      asOf,
    });
  }

  /** Only the tier waiver applies to overdraft interest; no facility means nothing to charge. */
  private async resolveWaiver(
    customerId: string,
    baseMinorUnits: number,
    feeMinorUnits: number,
  ): Promise<string | null> {
    if (baseMinorUnits <= 0 || feeMinorUnits <= 0) {
      return 'No arranged overdraft facility';
    }
    const customer = await this.connection
      .collection<CustomerRow>('customers')
      .findOne({ _id: customerId }, { projection: { tier: 1 } });
    return waiverReason(FEE_CODES.overdraft, feeMinorUnits, {
      customerTier: customer?.tier ?? null,
      balanceMinorUnits: 0,
      minimumBalanceMinorUnits: null,
      availableMinorUnits: Number.MAX_SAFE_INTEGER,
    });
  }
}
