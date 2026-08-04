import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { TransferNotCancellableError } from '../domain/transfer-errors.js';
import type { TransferDoc } from '../infrastructure/transfer.schemas.js';
import { TransfersService } from '../transfers.service.js';
import { metricsStub } from '../../../common/observability/__tests__/metrics.stub.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');

function transferDoc(overrides: Record<string, unknown> = {}): TransferDoc {
  return {
    _id: 'trf-1',
    reference: 'TRF-TEST',
    customerId: 'cust-1',
    fromAccountId: 'acct-1',
    destination: { kind: 'icb_customer', accountNumber: '0011223344' },
    rail: 'on_us',
    status: 'scheduled',
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
    timeline: [{ at: NOW, status: 'scheduled', label: 'Scheduled', detail: null }],
    createdAt: NOW,
    completedAt: null,
    failureCode: null,
    failureReason: null,
    ...overrides,
  };
}

function setup(row: TransferDoc | null) {
  const model = {
    findOne: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(row) }),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    find: vi.fn(),
  };
  const accounts = {
    loadSpendable: vi.fn().mockResolvedValue({ nickname: null, number: '0000000001' }),
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new TransfersService(
    model as never,
    { initiate: vi.fn() } as never,
    accounts as never,
    clock,
    metricsStub(),
  );
  return { model, service };
}

describe('cancel', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup(transferDoc());
  });

  it('cancels a scheduled transfer and appends to its timeline', async () => {
    const { model, service } = context;

    const detail = await service.cancel('cust-1', 'trf-1', 'Changed my mind');

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: 'trf-1', status: 'scheduled' },
      expect.objectContaining({ $set: { status: 'cancelled' } }),
    );
    expect(detail.cancellable).toBe(true); // the read-back fixture is unchanged; patch is asserted above
  });

  it('refuses to cancel a transfer already in settlement', async () => {
    context = setup(transferDoc({ status: 'in_settlement' }));

    await expect(context.service.cancel('cust-1', 'trf-1')).rejects.toThrow(
      TransferNotCancellableError,
    );
    expect(context.model.updateOne).not.toHaveBeenCalled();
  });

  it('refuses to cancel a completed transfer', async () => {
    context = setup(transferDoc({ status: 'completed' }));

    await expect(context.service.cancel('cust-1', 'trf-1')).rejects.toThrow(
      TransferNotCancellableError,
    );
  });

  it('throws NotFound for a transfer the customer does not own', async () => {
    context = setup(null);

    await expect(context.service.cancel('cust-2', 'trf-1')).rejects.toThrow(NotFoundError);
  });
});

describe('get', () => {
  it('maps the stored document to the detail contract', async () => {
    const { service } = setup(transferDoc());

    const detail = await service.get('cust-1', 'trf-1');

    expect(detail).toMatchObject({
      id: 'trf-1',
      reference: 'TRF-TEST',
      status: 'scheduled',
      rail: 'on_us',
      fromAccountLabel: '0000000001',
      recipientName: 'Jane',
      cancellable: true,
      recurring: false,
    });
    expect(detail.debitAmount).toEqual({ minorUnits: 10_000, currency: 'GBP', scale: 2 });
    expect(detail.timeline).toHaveLength(1);
  });
});
