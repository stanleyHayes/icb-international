import { describe, expect, it, vi } from 'vitest';

import type { TransferDoc } from '../../../modules/transfers/infrastructure/transfer.schemas.js';
import { RailSettlementStep } from '../steps/rail-settlement.step.js';
import { CONTEXT, NOW, inlineTransactions, sortedLeanQuery } from './fixtures.js';

function transfer(overrides: Partial<TransferDoc> = {}): TransferDoc {
  return {
    _id: 'tr-1',
    reference: 'TRF-0001',
    rail: 'ach',
    creditMinorUnits: 125_000,
    currency: 'USD',
    transactionId: 'txn-1',
    status: 'in_settlement',
    estimatedArrival: NOW,
    ...overrides,
  } as TransferDoc;
}

function setup(options: { due?: TransferDoc[]; matched?: number } = {}) {
  const transfers = {
    find: vi.fn().mockReturnValue(sortedLeanQuery(options.due ?? [transfer()])),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: options.matched ?? 1 }),
  };
  const ledger = { postWithin: vi.fn().mockResolvedValue({}), markSettled: vi.fn() };
  const metrics = { transferOutcome: vi.fn() };
  const step = new RailSettlementStep(
    transfers as never,
    ledger as never,
    inlineTransactions() as never,
    metrics as never,
  );
  return { step, transfers, ledger, metrics };
}

describe('RailSettlementStep.run', () => {
  it('selects only due in-settlement transfers and settles each once', async () => {
    const { step, transfers } = setup({ due: [transfer(), transfer({ _id: 'tr-2' })] });

    const settled = await step.run(CONTEXT);

    expect(settled).toBe(2);
    expect(transfers.find).toHaveBeenCalledWith({
      status: 'in_settlement',
      estimatedArrival: { $lte: NOW },
    });
  });

  it('is a quiet no-op when nothing is due', async () => {
    const { step, metrics } = setup({ due: [] });
    expect(await step.run(CONTEXT)).toBe(0);
    expect(metrics.transferOutcome).not.toHaveBeenCalled();
  });
});

describe('RailSettlementStep claim and posting', () => {
  it('claims with a conditional update before posting', async () => {
    const { step, transfers, ledger, metrics } = setup();

    expect(await step.run(CONTEXT)).toBe(1);

    expect(transfers.updateOne).toHaveBeenCalledWith(
      { _id: 'tr-1', status: 'in_settlement' },
      { $set: { status: 'completed', completedAt: NOW } },
      { session: expect.anything() },
    );
    expect(ledger.postWithin).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'transfer_out',
        status: 'settled',
        sourceType: 'transfer',
        sourceId: 'tr-1',
        valueDate: CONTEXT.businessDate,
      }),
      expect.anything(),
    );
    expect(metrics.transferOutcome).toHaveBeenCalledWith('ach', 'completed');
  });

  it('posts nothing and counts nothing when a concurrent run won the claim', async () => {
    const { step, ledger, metrics } = setup({ matched: 0 });

    expect(await step.run(CONTEXT)).toBe(0);
    expect(ledger.postWithin).not.toHaveBeenCalled();
    expect(metrics.transferOutcome).not.toHaveBeenCalled();
  });

  it('marks the originating ledger transaction settled when one exists', async () => {
    const { step, ledger } = setup();
    await step.run(CONTEXT);
    expect(ledger.markSettled).toHaveBeenCalledWith('txn-1', expect.anything());
  });

  it('skips markSettled for a transfer with no ledger transaction', async () => {
    const { step, ledger } = setup({ due: [transfer({ transactionId: null })] });
    await step.run(CONTEXT);
    expect(ledger.markSettled).not.toHaveBeenCalled();
  });

  it('carries the full amount through the pending-settlement pair', async () => {
    const { step, ledger } = setup();
    await step.run(CONTEXT);

    const [posting] = ledger.postWithin.mock.calls[0] as [
      { lines: { direction: string; amount: { minorUnits: number; currency: string } }[] },
    ];
    expect(posting.lines).toHaveLength(2);
    expect(posting.lines[0]?.amount).toEqual({ minorUnits: 125_000, currency: 'USD' });
    expect(posting.lines.map((line) => line.direction)).toEqual(['debit', 'credit']);
  });
});
