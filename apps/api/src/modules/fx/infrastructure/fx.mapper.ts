import type { FxQuote, FxRate, MoneyDto } from '@icb/contracts';
import { getScale, type CurrencyCode } from '@icb/money';

import { pairKey, type CurrencyPair } from '../domain/fx-pair.js';
import type { FxQuoteDoc, FxRateDoc } from './fx.schemas.js';

const MS_PER_SECOND = 1000;

/** Money on the wire. Local to this module so FX does not reach into another module's mapper. */
export function toMoneyDto(minorUnits: number, currency: CurrencyCode): MoneyDto {
  return { minorUnits, currency, scale: getScale(currency) };
}

export interface ComputedRate {
  readonly pair: CurrencyPair;
  readonly mid: number;
  readonly buy: number;
  readonly sell: number;
  readonly spreadBps: number;
  readonly changePercent24h: number;
  readonly effectiveAt: Date;
}

export function toFxRate(computed: ComputedRate): FxRate {
  return {
    pair: pairKey(computed.pair.base, computed.pair.quote),
    base: computed.pair.base,
    quote: computed.pair.quote,
    mid: computed.mid,
    buy: computed.buy,
    sell: computed.sell,
    spreadBps: computed.spreadBps,
    changePercent24h: computed.changePercent24h,
    effectiveAt: computed.effectiveAt.toISOString(),
  };
}

/** The persisted board row. `_id` is deliberately absent so an upsert never rewrites identity. */
export function toRateDocumentFields(rate: FxRate): Omit<FxRateDoc, '_id'> {
  return {
    pair: rate.pair,
    base: rate.base,
    quote: rate.quote,
    mid: rate.mid,
    buy: rate.buy,
    sell: rate.sell,
    spreadBps: rate.spreadBps,
    changePercent24h: rate.changePercent24h,
    effectiveAt: new Date(rate.effectiveAt),
  };
}

/**
 * A quote as the customer sees it.
 *
 * `validForSeconds` is recomputed against the caller's "now" rather than stored, because the
 * countdown a client renders has to shrink between the issue call and the poll that follows it.
 */
export function toFxQuote(doc: FxQuoteDoc, now: Date): FxQuote {
  const remainingMs = doc.expiresAt.getTime() - now.getTime();
  return {
    quoteId: doc._id,
    from: toMoneyDto(doc.fromMinorUnits, doc.fromCurrency as CurrencyCode),
    to: toMoneyDto(doc.toMinorUnits, doc.toCurrency as CurrencyCode),
    rate: doc.rate,
    midRate: doc.midRate,
    spreadBps: doc.spreadBps,
    expiresAt: doc.expiresAt.toISOString(),
    validForSeconds: Math.max(1, Math.ceil(remainingMs / MS_PER_SECOND)),
  };
}
