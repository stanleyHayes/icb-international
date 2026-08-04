import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { AccountDoc } from '../../../modules/accounts/infrastructure/account.schemas.js';
import type { LedgerEntryDoc } from '../../../modules/ledger/infrastructure/ledger.schemas.js';
import type { ExternalCollections } from '../infrastructure/external-collections.js';
import { AmlMonitoringStep } from '../steps/aml-monitoring.step.js';
import { BUSINESS_DATE, CONTEXT, NOW, leanQuery } from './fixtures.js';

interface DayCredits {
  _id: { ref: string; currency: string };
  total: number;
  largest: number;
  count: number;
}

function credits(overrides: Partial<DayCredits> = {}): DayCredits {
  return {
    _id: { ref: 'acct:acct-1', currency: 'USD' },
    total: 1_200_000,
    largest: 900_000,
    count: 3,
    ...overrides,
  };
}

function setup(rows: DayCredits[], existingAlert: unknown = null, account: unknown = {
  _id: 'acct-1',
  customerId: 'cust-9',
}) {
  const entries = { aggregate: vi.fn().mockResolvedValue(rows) };
  const accounts = { findById: vi.fn().mockReturnValue(leanQuery(account)) };
  const alerts = {
    findOne: vi.fn().mockResolvedValue(existingAlert),
    insertOne: vi.fn().mockResolvedValue({}),
  };
  const external = { amlAlerts: vi.fn().mockReturnValue(alerts) };

  const step = new AmlMonitoringStep(
    entries as unknown as Model<LedgerEntryDoc>,
    accounts as unknown as Model<AccountDoc>,
    external as unknown as ExternalCollections,
  );
  return { step, entries, accounts, alerts };
}

describe('AmlMonitoringStep', () => {
  it('aggregates the day’s customer credits for the business date', async () => {
    const { step, entries } = setup([]);

    const raised = await step.run(CONTEXT);

    expect(raised).toBe(0);
    expect(entries.aggregate).toHaveBeenCalledWith([
      {
        $match: {
          valueDate: BUSINESS_DATE,
          direction: 'credit',
          accountRef: { $regex: '^acct:' },
        },
      },
      expect.objectContaining({ $group: expect.anything() }),
    ]);
  });

  it('raises a high-severity alert for a single credit at the threshold', async () => {
    const { step, alerts } = setup([credits({ largest: 1_000_000, total: 1_000_000, count: 1 })]);

    const raised = await step.run(CONTEXT);

    expect(raised).toBe(1);
    expect(alerts.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-9',
        subjectRef: 'acct:acct-1',
        kind: 'large_value',
        severity: 'high',
        status: 'open',
        assignedTo: null,
        source: 'end-of-day',
        businessDate: BUSINESS_DATE,
        createdAt: NOW,
        narrative:
          'Single credit of 1000000 USD minor units at or above the reporting threshold.',
      }),
    );
  });

  it('prefers the large-value rule when both patterns match', async () => {
    const { step, alerts } = setup([credits({ largest: 1_500_000, total: 2_000_000, count: 3 })]);

    await step.run(CONTEXT);

    expect(alerts.insertOne).toHaveBeenCalledWith(expect.objectContaining({ kind: 'large_value' }));
  });

  it('raises a medium-severity alert for structuring under the threshold', async () => {
    const { step, alerts } = setup([credits()]);

    const raised = await step.run(CONTEXT);

    expect(raised).toBe(1);
    expect(alerts.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'structuring',
        severity: 'medium',
        narrative:
          '3 credits totalling 1200000 USD minor units, each individually below the reporting threshold.',
      }),
    );
  });

  it('ignores activity that matches neither rule', async () => {
    const { step, alerts } = setup([
      credits({ largest: 900_000, total: 900_000, count: 1 }),
      credits({ _id: { ref: 'acct:acct-2', currency: 'USD' }, largest: 100, total: 500, count: 5 }),
    ]);

    const raised = await step.run(CONTEXT);

    expect(raised).toBe(0);
    expect(alerts.insertOne).not.toHaveBeenCalled();
  });

  it('does not re-raise an alert the batch already wrote for the day', async () => {
    const { step, alerts } = setup([credits()], { _id: 'alert-1' });

    const raised = await step.run(CONTEXT);

    expect(raised).toBe(0);
    expect(alerts.findOne).toHaveBeenCalledWith({
      source: 'end-of-day',
      businessDate: BUSINESS_DATE,
      subjectRef: 'acct:acct-1',
      kind: 'structuring',
    });
    expect(alerts.insertOne).not.toHaveBeenCalled();
  });

  it('attributes the alert to an unknown customer when the account is gone', async () => {
    const { step, alerts } = setup([credits()], null, null);

    const raised = await step.run(CONTEXT);

    expect(raised).toBe(1);
    expect(alerts.insertOne).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'unknown' }),
    );
  });

  it('counts one alert per flagged account-currency row', async () => {
    const { step } = setup([
      credits(),
      credits({ _id: { ref: 'acct:acct-2', currency: 'EUR' }, largest: 2_000_000 }),
      credits({ _id: { ref: 'acct:acct-3', currency: 'USD' }, largest: 1, total: 2, count: 1 }),
    ]);

    const raised = await step.run(CONTEXT);

    expect(raised).toBe(2);
  });
});
