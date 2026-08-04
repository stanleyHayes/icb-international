import type { ClientSession } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InsufficientFundsError } from '../../../../common/errors/index.js';
import { ClockService } from '../../../../simulation/clock/clock.service.js';
import { TRANSFER_EVENTS } from '../../domain/transfers.constants.js';
import type { TransferDoc } from '../../infrastructure/transfer.schemas.js';
import { ScheduledTransfersExecutor } from '../scheduled-transfers.executor.js';
import { metricsStub } from '../../../../common/observability/__tests__/metrics.stub.js';

const NOW = new Date('2026-08-10T09:00:00.000Z');
const session = { id: 'txn' } as unknown as ClientSession;

function scheduledDoc(overrides: Record<string, unknown> = {}): TransferDoc {
  return {
    _id: 'trf-1',
    reference: 'TRF-TEST',
    customerId: 'cust-1',
    fromAccountId: 'acct-1',
    destination: { kind: 'icb_customer', accountNumber: '0011223344' },
    rail: 'on_us',
    status: 'processing',
    debitMinorUnits: 10_000,
    creditMinorUnits: 10_000,
    currency: 'GBP',
    creditCurrency: 'GBP',
    feeMinorUnits: 0,
    feeBreakdown: [],
    fx: null,
    recipientName: 'Jane',
    recipientMasked: '•••• 3344',
    customerReference: null,
    note: null,
    transactionId: null,
    railReference: null,
    estimatedArrival: NOW,
    executeAt: NOW,
    schedule: null,
    standingOrderId: null,
    nextOccurrenceAt: null,
    recurring: false,
    timeline: [],
    createdAt: NOW,
    completedAt: null,
    failureCode: null,
    failureReason: null,
    ...overrides,
  };
}

function setup() {
  const model = {
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const orchestrator = {
    executePrepared: vi.fn().mockResolvedValue({
      transactionId: 'txn-1',
      status: 'completed',
      ledgerStatus: 'posted',
      estimatedArrival: NOW,
      railReference: null,
      detail: null,
    }),
    publishSent: vi.fn().mockResolvedValue(undefined),
    advanceSeries: vi.fn().mockResolvedValue(null),
    // The executor asks which balances it will contend on before opening the transaction.
    contendedKeys: vi.fn().mockResolvedValue(['balance:acc:cus-1:USD']),
  };
  const preparation = {
    preparedFromDocument: vi.fn().mockResolvedValue({ transferId: 'trf-1' }),
    assertFunds: vi.fn().mockResolvedValue(undefined),
  };
  const transactionManager = {
    withTransaction: vi.fn().mockImplementation((cb: (s: ClientSession) => unknown) => cb(session)),
  };
  const outbox = { publish: vi.fn().mockResolvedValue('evt-1') };
  const clock = new ClockService();
  clock.freeze(NOW);
  const executor = new ScheduledTransfersExecutor(
    model as never,
    orchestrator as never,
    preparation as never,
    transactionManager as never,
    outbox as never,
    clock,
    metricsStub(),
  );
  return { model, orchestrator, preparation, outbox, executor };
}

function lean(value: unknown) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

describe('executeDue', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('is a no-op when the transfer was already claimed (redelivery)', async () => {
    context.model.findOneAndUpdate.mockReturnValue(lean(null));

    await context.executor.executeDue('trf-1');

    expect(context.orchestrator.executePrepared).not.toHaveBeenCalled();
    expect(context.model.updateOne).not.toHaveBeenCalled();
  });

  it('executes, records the outcome and notifies', async () => {
    context.model.findOneAndUpdate.mockReturnValue(lean(scheduledDoc()));

    await context.executor.executeDue('trf-1');

    expect(context.preparation.assertFunds).toHaveBeenCalled();
    expect(context.orchestrator.executePrepared).toHaveBeenCalled();
    expect(context.model.updateOne).toHaveBeenCalledWith(
      { _id: 'trf-1' },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'completed' }) }),
      { session },
    );
    expect(context.orchestrator.publishSent).toHaveBeenCalled();
  });

  it('schedules the next occurrence of a standing order via the outbox', async () => {
    const nextRun = new Date('2026-08-17T09:00:00.000Z');
    context.model.findOneAndUpdate.mockReturnValue(lean(scheduledDoc({ standingOrderId: 'so-1' })));
    context.orchestrator.advanceSeries.mockResolvedValue({
      transferId: 'trf-2',
      executeAt: nextRun,
    });

    await context.executor.executeDue('trf-1');

    expect(context.outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: TRANSFER_EVENTS.due,
        payload: { transferId: 'trf-2' },
        availableAt: nextRun,
      }),
      session,
    );
  });

  it('marks the transfer failed with the domain code when execution fails', async () => {
    context.model.findOneAndUpdate.mockReturnValue(lean(scheduledDoc()));
    context.preparation.assertFunds.mockRejectedValue(
      new InsufficientFundsError(
        'acct-1',
        { minorUnits: 10_000, currency: 'GBP' },
        { minorUnits: 0, currency: 'GBP' },
      ),
    );

    await context.executor.executeDue('trf-1');

    expect(context.model.updateOne).toHaveBeenCalledWith(
      { _id: 'trf-1' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'failed', failureCode: 'INSUFFICIENT_FUNDS' }),
      }),
      { session },
    );
    expect(context.outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: TRANSFER_EVENTS.failed }),
      session,
    );
    expect(context.orchestrator.executePrepared).not.toHaveBeenCalled();
  });
});
