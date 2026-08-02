import { convert, fromMinorUnits, type CurrencyCode, type Money } from '@icb/money';
import { Injectable } from '@nestjs/common';

import { glRef, type AccountRef } from '../ledger/domain/account-ref.js';
import { GL_FX_INCOME, GL_FX_ROUNDING } from '../ledger/domain/chart-of-accounts.js';
import type { PostingLine } from '../ledger/domain/posting.types.js';

export interface ConvertedMoney {
  readonly converted: Money;
  /**
   * The fraction of a minor unit lost or gained to rounding, in the target currency's minor
   * units. Surfaced rather than swallowed so the caller can close it against GL 9000.
   */
  readonly roundingDelta: number;
  readonly rate: number;
}

export interface FxPostingInput {
  readonly sourceRef: AccountRef;
  readonly targetRef: AccountRef;
  readonly from: Money;
  readonly to: Money;
  readonly roundingDelta: number;
  readonly narrative?: string;
}

const DEFAULT_NARRATIVE = 'Currency conversion';

/**
 * Cross-currency arithmetic and the postings that keep it balanced.
 *
 * The ledger balances *per currency*, not across them: 100 USD out and 92 EUR in is correct and
 * must never be netted. That means a conversion is not two legs but two closed pairs — the
 * source pair in the source currency, the target pair in the target currency — with the bank's
 * FX book (4200) standing between them. The rounding remainder, which by definition cannot be
 * expressed in either amount, closes against 9000.
 */
@Injectable()
export class FxConversionService {
  /**
   * Convert at a given rate, keeping the remainder.
   *
   * `rate` is target units per one source unit and must already carry the spread — this method
   * prices nothing, it only does the arithmetic, so there is exactly one place where a spread
   * could be applied twice and it is not here.
   */
  convertMoney(amount: Money, to: CurrencyCode, rate: number): ConvertedMoney {
    const result = convert({ amount, to, rate });
    return {
      converted: result.converted,
      roundingDelta: result.roundingDelta,
      rate: result.rate,
    };
  }

  /**
   * The posting lines for a cross-currency movement.
   *
   * Three legs, in the order the money travels: the source leg debits the customer and credits
   * the FX book; the target leg debits the FX book and credits the customer; the rounding leg
   * parks whatever a whole minor unit could not represent in GL 9000. Every currency in the
   * result nets to zero, so `LedgerService.post()` accepts it as-is.
   */
  buildPostingLines(input: FxPostingInput): PostingLine[] {
    const narrative = input.narrative ?? DEFAULT_NARRATIVE;
    const book = glRef(GL_FX_INCOME);

    return [
      { accountRef: input.sourceRef, direction: 'debit', amount: input.from, narrative },
      { accountRef: book, direction: 'credit', amount: input.from, narrative },
      { accountRef: book, direction: 'debit', amount: input.to, narrative },
      { accountRef: input.targetRef, direction: 'credit', amount: input.to, narrative },
      ...this.roundingLines(input.roundingDelta, input.to.currency, narrative),
    ];
  }

  /**
   * The rounding leg.
   *
   * A remainder smaller than a minor unit cannot be posted — it is carried, not booked — so the
   * pair is emitted only once the delta reaches a whole unit. Emitting a zero-amount leg would
   * be rejected by `assertPositiveAmounts`, and rightly so.
   */
  private roundingLines(
    roundingDelta: number,
    currency: CurrencyCode,
    narrative: string,
  ): PostingLine[] {
    const whole = Math.round(roundingDelta);
    if (whole === 0) {
      return [];
    }

    const amount = fromMinorUnits(Math.abs(whole), currency);
    const rounding = glRef(GL_FX_ROUNDING);
    const book = glRef(GL_FX_INCOME);
    const kept = whole > 0;

    return [
      {
        accountRef: kept ? book : rounding,
        direction: 'debit',
        amount,
        narrative: `${narrative} — rounding`,
      },
      {
        accountRef: kept ? rounding : book,
        direction: 'credit',
        amount,
        narrative: `${narrative} — rounding`,
      },
    ];
  }
}
