import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { CardLimitsDoc } from '../domain/card-defaults.js';
import { CardAuthorisationDoc } from '../infrastructure/card-authorisation.schemas.js';
import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import type { CardSpend } from '../infrastructure/card.mapper.js';

/** Spend against a card, in the two windows the limits are expressed in. */
export interface SpendWindow {
  readonly todayMinorUnits: number;
  readonly monthMinorUnits: number;
  readonly atmTodayMinorUnits: number;
}

/**
 * An authorisation counts against a limit from the moment it is approved, not from the moment it
 * settles. Anything else lets a customer spend their daily limit twice over in the window between
 * tapping their card and the merchant claiming the money.
 */
const COUNTED_STATUSES = ['approved', 'captured'] as const;

const AUTHORISED_AT = 'authorisedAt';

/**
 * Spend aggregation.
 *
 * Derived from the authorisation log every time rather than kept in a running counter on the card.
 * A counter would need resetting at midnight and at month end, would drift whenever an
 * authorisation reversed, and would be wrong for exactly as long as nobody noticed.
 */
@Injectable()
export class CardSpendService {
  constructor(
    @InjectModel(CardAuthorisationDoc.name)
    private readonly authorisations: Model<CardAuthorisationDoc>,
    private readonly clock: ClockService,
  ) {}

  async windowFor(cardId: string): Promise<SpendWindow> {
    const now = this.clock.now();
    const dayStart = this.clock.startOfDay(now);
    const monthStart = this.clock.monthBounds(now).from;
    const base = { cardId, status: { $in: COUNTED_STATUSES } };

    const [todayMinorUnits, monthMinorUnits, atmTodayMinorUnits] = await Promise.all([
      this.total({ ...base, [AUTHORISED_AT]: { $gte: dayStart } }),
      this.total({ ...base, [AUTHORISED_AT]: { $gte: monthStart } }),
      this.total({ ...base, channel: 'atm', [AUTHORISED_AT]: { $gte: dayStart } }),
    ]);

    return { todayMinorUnits, monthMinorUnits, atmTodayMinorUnits };
  }

  /** The customer-facing view: what has been spent, and what is left before a limit bites. */
  toSpendDto(window: SpendWindow, limits: CardLimitsDoc, currency: string): CardSpend {
    return {
      todaySpent: toMoneyDto(window.todayMinorUnits, currency),
      monthSpent: toMoneyDto(window.monthMinorUnits, currency),
      dailyRemaining: toMoneyDto(
        remaining(limits.dailyMinorUnits, window.todayMinorUnits),
        currency,
      ),
      monthlyRemaining: toMoneyDto(
        remaining(limits.monthlyMinorUnits, window.monthMinorUnits),
        currency,
      ),
    };
  }

  /**
   * Sums what the customer is actually on the hook for: the captured amount once a merchant has
   * claimed it, and the full authorised amount until then. A partial capture must not keep the
   * unclaimed remainder counting against the limit.
   */
  private async total(filter: Record<string, unknown>): Promise<number> {
    const rows = await this.authorisations.aggregate<{ total: number }>([
      { $match: filter },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ['$capturedMinorUnits', '$minorUnits'] } },
        },
      },
    ]);
    return rows[0]?.total ?? 0;
  }
}

/** Headroom never goes negative — an over-limit card has nothing left, not a debt. */
function remaining(limitMinorUnits: number, spentMinorUnits: number): number {
  return Math.max(0, limitMinorUnits - spentMinorUnits);
}
