import type { CurrencyCode } from '@icb/money';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../../common/errors/index.js';
import { newId } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { customerDisplayName } from '../../kyc/infrastructure/customer-profile.js';
import { customerRef } from '../../ledger/domain/account-ref.js';
import { LedgerEntryDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import { MS_PER_DAY } from '../domain/rules/rule.params.js';
import type { HistoryPoint, RuleContext } from '../domain/rules/rule.types.js';
import { RiskProfileDoc } from '../infrastructure/risk-rule.schemas.js';

/** Signals only the caller can know: which device, which country, which payee, which merchant. */
export interface RiskSignals {
  readonly beneficiaryId?: string | null;
  readonly countryCode?: string | null;
  readonly deviceId?: string | null;
  readonly mcc?: string | null;
}

export interface ContextRequest {
  readonly customerId: string;
  readonly amountMinorUnits: number;
  readonly currency: CurrencyCode;
  readonly signals: RiskSignals;
}

/** Ninety days is enough to establish a pattern without letting a year-old habit dominate it. */
const HISTORY_LOOKBACK_DAYS = 90;
const HISTORY_LIMIT = 250;
const SETTLED = ['posted', 'settled'];

/** What the caller observed about this specific event. Absent means "unknown", never "safe". */
function suppliedSignals(
  signals: RiskSignals,
): Pick<RuleContext, 'beneficiaryId' | 'countryCode' | 'deviceId' | 'mcc'> {
  return {
    beneficiaryId: signals.beneficiaryId ?? null,
    countryCode: signals.countryCode ?? null,
    deviceId: signals.deviceId ?? null,
    mcc: signals.mcc ?? null,
  };
}

/** What the customer has done before. A customer with no profile yet has no baseline at all. */
function establishedBaseline(
  profile: RiskProfileDoc | null,
): Pick<
  RuleContext,
  'knownBeneficiaryIds' | 'knownDeviceIds' | 'lastCountryCode' | 'lastCountryAt'
> {
  return {
    knownBeneficiaryIds: profile?.knownBeneficiaryIds ?? [],
    knownDeviceIds: profile?.knownDeviceIds ?? [],
    lastCountryCode: profile?.lastCountryCode ?? null,
    lastCountryAt: profile?.lastCountryAt ?? null,
  };
}

/**
 * Assembling everything the rules are allowed to see, once.
 *
 * Ten rules sharing one context rather than issuing their own queries is not only faster — it is
 * what makes a decision reproducible. Every rule saw the same history, from the same instant, so
 * replaying the assessment cannot produce a different answer.
 */
@Injectable()
export class RiskContextService {
  constructor(
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    @InjectModel(LedgerEntryDoc.name) private readonly entries: Model<LedgerEntryDoc>,
    @InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>,
    @InjectModel(RiskProfileDoc.name) private readonly profiles: Model<RiskProfileDoc>,
    private readonly clock: ClockService,
  ) {}

  async build(request: ContextRequest): Promise<{ context: RuleContext; customerName: string }> {
    const customer = await this.customers.findById(request.customerId).lean();
    if (!customer) {
      throw new NotFoundError('Customer', request.customerId);
    }

    const [history, profile] = await Promise.all([
      this.loadHistory(request.customerId),
      this.profiles.findOne({ customerId: request.customerId }).lean(),
    ]);

    const context: RuleContext = {
      customerId: request.customerId,
      amountMinorUnits: request.amountMinorUnits,
      currency: request.currency,
      at: this.clock.now(),
      history,
      ...suppliedSignals(request.signals),
      ...establishedBaseline(profile),
      lastActivityAt: customer.lastActivityAt ?? history[0]?.at ?? null,
    };

    return { context, customerName: customerDisplayName(customer) };
  }

  /** Debits only: what the customer *spends* is the distribution the rules model. */
  private async loadHistory(customerId: string): Promise<HistoryPoint[]> {
    const accounts = await this.accounts.find({ customerId }).select('_id').lean();
    if (accounts.length === 0) {
      return [];
    }

    const since = new Date(this.clock.epochMs() - HISTORY_LOOKBACK_DAYS * MS_PER_DAY);
    const rows = await this.entries
      .find({
        accountRef: { $in: accounts.map((account) => customerRef(account._id)) },
        direction: 'debit',
        transactionStatus: { $in: SETTLED },
        bookedAt: { $gte: since },
      })
      .sort({ bookedAt: -1 })
      .limit(HISTORY_LIMIT)
      .lean();

    return rows.map((row) => ({ minorUnits: row.minorUnits, at: row.bookedAt }));
  }

  /**
   * Fold what we just saw back into the customer's baseline.
   *
   * Ordering matters: this runs *after* the rules, so the device that triggered "unrecognised
   * device" is not already in the known list by the time the rule looks at it.
   */
  async observe(request: ContextRequest): Promise<void> {
    const now = this.clock.now();
    const addToSet: Record<string, string> = {};
    if (request.signals.deviceId) {
      addToSet['knownDeviceIds'] = request.signals.deviceId;
    }
    if (request.signals.beneficiaryId) {
      addToSet['knownBeneficiaryIds'] = request.signals.beneficiaryId;
    }

    await this.profiles.updateOne(
      { customerId: request.customerId },
      {
        $set: this.lastSeenFields(request, now),
        $inc: { assessmentCount: 1 },
        ...(Object.keys(addToSet).length > 0 ? { $addToSet: addToSet } : {}),
        $setOnInsert: { _id: newId(), customerId: request.customerId },
      },
      { upsert: true },
    );
  }

  private lastSeenFields(request: ContextRequest, now: Date): Partial<RiskProfileDoc> {
    return {
      lastAssessedAt: now,
      ...(request.signals.countryCode
        ? { lastCountryCode: request.signals.countryCode, lastCountryAt: now }
        : {}),
    };
  }
}
