import { CURRENCY_CODES, isCurrencyCode, type CurrencyCode } from '@icb/money';

import { ValidationError } from '../../../common/errors/index.js';

/**
 * Currency pairs.
 *
 * A pair is written `BASE/QUOTE` and its rate is always "quote units per one base unit". Stating
 * that once, here, is what stops half the codebase inverting the other half — the single most
 * common defect in FX code.
 */
export interface CurrencyPair {
  readonly base: CurrencyCode;
  readonly quote: CurrencyCode;
}

export function pairKey(base: CurrencyCode, quote: CurrencyCode): string {
  return `${base}/${quote}`;
}

/**
 * Parse a pair from a URL segment.
 *
 * A slash cannot survive a path parameter, so `EUR-USD` and `EURUSD` are accepted alongside the
 * canonical `EUR/USD` and normalised to it. Anything else is a client error, not a 500.
 */
export function parsePair(value: string): CurrencyPair {
  const normalised = value.trim().toUpperCase().replaceAll(/[-_\s]/g, '');
  const [rawBase, rawQuote] = normalised.includes('/')
    ? normalised.split('/')
    : [normalised.slice(0, 3), normalised.slice(3)];

  if (!isCurrencyCode(rawBase) || !isCurrencyCode(rawQuote)) {
    throw invalidPair(value);
  }
  if (rawBase === rawQuote) {
    throw new ValidationError('A currency pair must have two different currencies', [
      { path: 'pair', message: `${rawBase} cannot be quoted against itself` },
    ]);
  }
  return { base: rawBase, quote: rawQuote };
}

function invalidPair(value: string): ValidationError {
  return new ValidationError('That is not a currency pair ICB quotes', [
    { path: 'pair', message: `Expected something like EUR-USD, received "${value}"` },
  ]);
}

/** Every ordered pair among the supported currencies — both directions, never self-quoted. */
export function listPairs(): CurrencyPair[] {
  const pairs: CurrencyPair[] = [];
  for (const base of CURRENCY_CODES) {
    for (const quote of CURRENCY_CODES) {
      if (base !== quote) {
        pairs.push({ base, quote });
      }
    }
  }
  return pairs;
}
