import { type RateTable } from '@icb/contracts';
import { describe, expect, it, vi } from 'vitest';

import type { ContentRatesService } from '../../content/application/content-rates.service.js';
import { RatesService } from '../rates.service.js';

const LAYERED: RateTable = {
  effectiveFrom: '2026-08-02T12:00:00.000Z',
  savings: [{ productCode: 'ICB-SAVINGS', name: 'ICB Reserve Savings', rate: 4.15 }],
  deposits: [],
  loans: [],
};

function setup() {
  const contentRates = {
    getLayeredRateTable: vi.fn().mockResolvedValue(LAYERED),
    invalidate: vi.fn().mockResolvedValue(undefined),
  };
  const service = new RatesService(contentRates as unknown as ContentRatesService);
  return { contentRates, service };
}

describe('getRateTable', () => {
  it('serves the layered table assembled by the content vertical', async () => {
    const { contentRates, service } = setup();

    const table = await service.getRateTable();

    expect(table).toEqual(LAYERED);
    expect(contentRates.getLayeredRateTable).toHaveBeenCalledOnce();
  });
});

describe('invalidate', () => {
  it('drops the shared layered-table cache so catalogue writes never serve stale', async () => {
    const { contentRates, service } = setup();

    await service.invalidate();

    expect(contentRates.invalidate).toHaveBeenCalledOnce();
  });
});
