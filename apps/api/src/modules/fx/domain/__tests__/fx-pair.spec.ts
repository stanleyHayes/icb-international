import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../../../common/errors/index.js';
import { listPairs, pairKey, parsePair } from '../fx-pair.js';

describe('pairKey', () => {
  it('joins base and quote with a slash', () => {
    expect(pairKey('EUR', 'USD')).toBe('EUR/USD');
  });
});

describe('parsePair', () => {
  it('accepts the canonical slash form', () => {
    expect(parsePair('EUR/USD')).toEqual({ base: 'EUR', quote: 'USD' });
  });

  it('normalises dashes, underscores, spaces and case', () => {
    expect(parsePair('eur-usd')).toEqual({ base: 'EUR', quote: 'USD' });
    expect(parsePair('GBP_USD')).toEqual({ base: 'GBP', quote: 'USD' });
    expect(parsePair(' ghs kes ')).toEqual({ base: 'GHS', quote: 'KES' });
  });

  it('splits a bare six-letter code at the midpoint', () => {
    expect(parsePair('EURUSD')).toEqual({ base: 'EUR', quote: 'USD' });
  });

  it('rejects unknown currencies', () => {
    expect(() => parsePair('EUR/XXX')).toThrow(ValidationError);
    expect(() => parsePair('nonsense')).toThrow(ValidationError);
  });

  it('rejects a pair quoted against itself', () => {
    expect(() => parsePair('EUR-EUR')).toThrow(/two different currencies/);
  });
});

describe('listPairs', () => {
  it('quotes every ordered pair and never a currency against itself', () => {
    const pairs = listPairs();
    expect(pairs).toHaveLength(210);
    expect(pairs.every((pair) => pair.base !== pair.quote)).toBe(true);
    expect(pairs).toContainEqual({ base: 'USD', quote: 'EUR' });
    expect(pairs).toContainEqual({ base: 'EUR', quote: 'USD' });
  });
});
