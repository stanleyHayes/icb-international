import {
  balanceHistoryQuerySchema,
  type AccountDetail,
  type BalanceHistory,
} from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { z } from 'zod';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import { customerRef } from '../../ledger/domain/account-ref.js';
import { LedgerEntryDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import {
  BALANCE_HISTORY_DEFAULT_DAYS,
  BALANCE_HISTORY_MAX_DAYS,
} from '../accounts.constants.js';
import { bucketClosingBalances } from '../domain/balance-history.js';
import { toMoneyDto } from '../infrastructure/account.mapper.js';

const MS_PER_DAY = 86_400_000;

type BalanceHistoryQuery = z.infer<typeof balanceHistoryQuerySchema>;

/** Entry statuses that represent real value movement (declined/expired never wrote entries). */
const COUNTED_STATUSES = ['posted', 'settled', 'reversed'] as const;

/**
 * The balance-history time series.
 *
 * Derived on read from `ledger_entries` value dates — nothing is precomputed, so the series is
 * always consistent with the ledger and a backdated posting simply rewrites the past it belongs
 * to, exactly as a statement regenerated later would show it.
 */
@Injectable()
export class BalanceHistoryService {
  constructor(
    @InjectModel(LedgerEntryDoc.name) private readonly entries: Model<LedgerEntryDoc>,
    private readonly clock: ClockService,
  ) {}

  async historyFor(
    account: AccountDetail,
    query: BalanceHistoryQuery,
  ): Promise<BalanceHistory> {
    const to = query.to ?? this.clock.today();
    const from = this.resolveFrom(query.from, to);
    const granularity = query.granularity;

    const rows = await this.entries
      .find({
        accountRef: customerRef(account.id),
        valueDate: { $lte: to },
        transactionStatus: { $in: [...COUNTED_STATUSES] },
      })
      .select({ valueDate: 1, signedMinorUnits: 1 })
      .lean();

    const points = bucketClosingBalances(rows, from, to, granularity);

    return {
      accountId: account.id,
      currency: account.currency,
      granularity,
      points: points.map((point) => ({
        date: point.date,
        closing: toMoneyDto(point.closingMinorUnits, account.currency),
      })),
    };
  }

  /** Default and clamp the window start so a chart query can never read the whole ledger. */
  private resolveFrom(requested: string | undefined, to: string): string {
    const toMs = Date.parse(`${to}T00:00:00.000Z`);
    const floor = toMs - BALANCE_HISTORY_MAX_DAYS * MS_PER_DAY;
    const fallback = toMs - BALANCE_HISTORY_DEFAULT_DAYS * MS_PER_DAY;
    const requestedMs = requested ? Date.parse(`${requested}T00:00:00.000Z`) : fallback;
    const clamped = Math.min(Math.max(requestedMs, floor), toMs);
    return new Date(clamped).toISOString().slice(0, 10);
  }
}
