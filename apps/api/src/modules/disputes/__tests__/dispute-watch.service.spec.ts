import { describe, expect, it, vi } from 'vitest';
import type { ClientSession, Model } from 'mongoose';

import type { AppConfiguration } from '../../../config/configuration.js';
import type { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import type { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { DisputeDoc } from '../../risk/infrastructure/dispute.schemas.js';
import type { DisputeWatchDoc } from '../infrastructure/dispute-watch.schemas.js';
import { DisputeWatchService } from '../application/dispute-watch.service.js';
import { DISPUTE_EVENT_TYPES } from '../disputes.constants.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const EARLIER = new Date('2026-08-01T09:00:00.000Z');
const session = { id: 'txn-1' } as unknown as ClientSession;

function disputeDoc(overrides: Partial<DisputeDoc> = {}): DisputeDoc {
  return {
    _id: 'dsp-1',
    reference: 'DSP-ABC123XY',
    customerId: 'cus-1',
    stage: 'investigating',
    amountMinorUnits: 12_345,
    currency: 'GBP',
    timeline: [{ at: EARLIER, stage: 'submitted', note: 'Dispute raised' }],
    slaDueAt: new Date('2026-08-20T00:00:00.000Z'),
    resolvedAt: null,
    ...overrides,
  } as DisputeDoc;
}

function setup(docs: DisputeDoc[], watermarks: Partial<DisputeWatchDoc>[] = []) {
  const disputes = {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({ limit: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(docs) })) })),
    })),
  };
  const watchStates = {
    find: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(watermarks) })),
    updateOne: vi.fn(() => ({ exec: vi.fn().mockResolvedValue({ acknowledged: true }) })),
  };
  const outbox = { publish: vi.fn().mockResolvedValue('evt-1') };
  const transactions = {
    withTransaction: vi.fn((work: (s: ClientSession) => Promise<unknown>) => work(session)),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new DisputeWatchService(
{ backgroundJobs: { enabled: true } } as AppConfiguration,
disputes as unknown as Model<DisputeDoc>,
    watchStates as unknown as Model<DisputeWatchDoc>,
    outbox as unknown as OutboxService,
    transactions as unknown as TransactionManager,
    clock,
  );
  return { service, outbox, watchStates, transactions };
}

describe('sweepOnce', () => {
  it('publishes each change inside one transaction and moves the watermark with it', async () => {
    const { service, outbox, watchStates, transactions } = setup([disputeDoc()]);

    const announced = await service.sweepOnce();

    expect(announced).toBe(1);
    expect(transactions.withTransaction).toHaveBeenCalledOnce();
    expect(outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: DISPUTE_EVENT_TYPES.StageChanged,
        payload: expect.objectContaining({ disputeId: 'dsp-1', stage: 'submitted' }),
      }),
      session,
    );
    expect(watchStates.updateOne).toHaveBeenCalledWith(
      { disputeId: 'dsp-1' },
      { $set: { seenTimelineEntries: 1 } },
      { upsert: true, session },
    );
  });

  it('stays quiet when every dispute is already watermarked', async () => {
    const { service, outbox, watchStates } = setup(
      [disputeDoc()],
      [{ disputeId: 'dsp-1', seenTimelineEntries: 1, slaAlertedAt: null }],
    );

    const announced = await service.sweepOnce();

    expect(announced).toBe(0);
    expect(outbox.publish).not.toHaveBeenCalled();
    expect(watchStates.updateOne).not.toHaveBeenCalled();
  });

  it('stamps slaAlertedAt only once the breach is announced', async () => {
    const overdue = disputeDoc({ slaDueAt: new Date('2026-08-01T00:00:00.000Z') });
    const { service, watchStates } = setup([overdue]);

    await service.sweepOnce();

    const [, update] = watchStates.updateOne.mock.calls[0] as unknown as [
      unknown,
      { $set: Record<string, unknown> },
    ];
    expect(update.$set).toMatchObject({ seenTimelineEntries: 1, slaAlertedAt: NOW });
  });

  it('keeps sweeping when one dispute cannot be announced', async () => {
    const quiet = disputeDoc({ _id: 'dsp-2' });
    const failing = disputeDoc({ _id: 'dsp-1' });
    const { service, outbox } = setup(
      [failing, quiet],
      [
        { disputeId: 'dsp-1', seenTimelineEntries: 0, slaAlertedAt: null },
        { disputeId: 'dsp-2', seenTimelineEntries: 1, slaAlertedAt: null },
      ],
    );
    outbox.publish.mockRejectedValue(new Error('primary stepped down'));

    const announced = await service.sweepOnce();

    expect(announced).toBe(0);
  });
});
