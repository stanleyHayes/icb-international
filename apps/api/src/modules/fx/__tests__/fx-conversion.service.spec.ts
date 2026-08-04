import { fromMinorUnits } from '@icb/money';
import { describe, expect, it } from 'vitest';

import { customerRef } from '../../ledger/domain/account-ref.js';
import { FxConversionService } from '../fx-conversion.service.js';

function accountRef(accountId: string) {
  return customerRef(accountId);
}

describe('FxConversionService.convertMoney', () => {
  const service = new FxConversionService();

  it('converts at the given rate and keeps the rounding remainder', () => {
    const result = service.convertMoney(fromMinorUnits(10_000, 'USD'), 'EUR', 0.92);

    expect(result.converted.currency).toBe('EUR');
    expect(result.rate).toBeCloseTo(0.92, 4);
    // The converted amount plus the delta reproduces the exact product.
    expect(result.converted.minorUnits + result.roundingDelta).toBeCloseTo(10_000 * 0.92, 6);
  });
});

describe('FxConversionService.buildPostingLines', () => {
  const service = new FxConversionService();

  function input(overrides: { roundingDelta?: number; narrative?: string } = {}) {
    return {
      sourceRef: accountRef('acc-usd'),
      targetRef: accountRef('acc-eur'),
      from: fromMinorUnits(10_000, 'USD'),
      to: fromMinorUnits(9_200, 'EUR'),
      roundingDelta: overrides.roundingDelta ?? 0,
      ...(overrides.narrative !== undefined ? { narrative: overrides.narrative } : {}),
    };
  }

  it('closes the source currency and the target currency through the FX book', () => {
    const lines = service.buildPostingLines(input());

    expect(lines).toHaveLength(4);
    const byCurrency = new Map<string, number>();
    for (const line of lines) {
      const signed = line.direction === 'debit' ? line.amount.minorUnits : -line.amount.minorUnits;
      byCurrency.set(line.amount.currency, (byCurrency.get(line.amount.currency) ?? 0) + signed);
    }
    expect(byCurrency.get('USD')).toBe(0);
    expect(byCurrency.get('EUR')).toBe(0);
    expect(lines[0]?.narrative).toBe('Currency conversion');
  });

  it('uses the caller narrative when given', () => {
    const lines = service.buildPostingLines(input({ narrative: 'Top up EUR wallet' }));
    // `?? false` rather than `?.`: a line with no narrative must fail this, not pass vacuously.
    expect(
      lines.every((line) => line.narrative?.startsWith('Top up EUR wallet') ?? false),
    ).toBe(true);
  });

  it('omits the rounding leg when the delta rounds to zero', () => {
    expect(service.buildPostingLines(input({ roundingDelta: 0.4 }))).toHaveLength(4);
  });

  it('books a kept remainder with the FX book debited and rounding GL credited', () => {
    const lines = service.buildPostingLines(input({ roundingDelta: 2 }));
    const rounding = lines.slice(4);

    expect(rounding).toHaveLength(2);
    expect(rounding[0]).toMatchObject({ direction: 'debit' });
    expect(rounding[1]).toMatchObject({ direction: 'credit' });
    expect(rounding[0]?.amount.minorUnits).toBe(2);
  });

  it('books a given-away remainder with rounding GL debited and the FX book credited', () => {
    const lines = service.buildPostingLines(input({ roundingDelta: -3 }));
    const rounding = lines.slice(4);

    expect(rounding).toHaveLength(2);
    expect(rounding[0]?.direction).toBe('debit');
    expect(rounding[1]?.direction).toBe('credit');
    expect(rounding[0]?.amount.minorUnits).toBe(3);
    expect(rounding[0]?.narrative).toContain('rounding');
  });
});
