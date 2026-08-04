import { describe, expect, it, vi } from 'vitest';

import type {
  OutboxConsumerService,
  OutboxEvent,
} from '../../../infrastructure/outbox/outbox-consumer.service.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import type { NotificationsService } from '../../notifications/notifications.service.js';
import { DisputeCommsService } from '../application/dispute-comms.service.js';
import { DISPUTE_COMMS_CONSUMER, DISPUTE_EVENT_TYPES } from '../disputes.constants.js';

const AMOUNT = { minorUnits: 12_345, currency: 'GBP', scale: 2 } as const;

function setup() {
  const handlers = new Map<string, (event: OutboxEvent) => Promise<void>>();
  const consumers = {
    register: vi.fn((type: string, _consumer: string, handler: (event: OutboxEvent) => Promise<void>) => {
      handlers.set(type, handler);
    }),
  };
  const notifications = { notify: vi.fn().mockResolvedValue([]) };
  const service = new DisputeCommsService(
{ backgroundJobs: { enabled: true } } as AppConfiguration,
consumers as unknown as OutboxConsumerService,
    notifications as unknown as NotificationsService,
  );
  service.onApplicationBootstrap();
  return { consumers, handlers, notifications };
}

/** The watcher sweeps on a timer, outside any request, so its events carry no correlation id. */
function event(type: string, payload: Record<string, unknown>): OutboxEvent {
  return { id: 'evt-1', type, payload, attempts: 1, correlationId: null };
}

describe('onApplicationBootstrap', () => {
  it('subscribes one handler per dispute event type under the module consumer name', () => {
    const { consumers } = setup();

    expect(consumers.register).toHaveBeenCalledWith(
      DISPUTE_EVENT_TYPES.StageChanged,
      DISPUTE_COMMS_CONSUMER,
      expect.any(Function),
    );
    expect(consumers.register).toHaveBeenCalledWith(
      DISPUTE_EVENT_TYPES.SlaBreached,
      DISPUTE_COMMS_CONSUMER,
      expect.any(Function),
    );
  });
});

describe('stage changed', () => {
  it('tells the customer their dispute moved, quoting reference, stage and analyst note', async () => {
    const { handlers, notifications } = setup();

    await handlers.get(DISPUTE_EVENT_TYPES.StageChanged)?.(
      event(DISPUTE_EVENT_TYPES.StageChanged, {
        disputeId: 'dsp-1',
        reference: 'DSP-ABC123XY',
        customerId: 'cus-1',
        stage: 'provisional_credit',
        note: 'Provisional credit granted',
        occurredAt: '2026-08-02T12:00:00.000Z',
        amount: AMOUNT,
      }),
    );

    expect(notifications.notify).toHaveBeenCalledWith('dispute_update', 'cus-1', {
      reference: 'DSP-ABC123XY',
      status: 'provisional_credit',
      detail: 'Provisional credit granted',
      amount: AMOUNT,
    });
  });

  it('rejects a malformed payload rather than mailing nonsense', async () => {
    const { handlers } = setup();

    await expect(
      handlers.get(DISPUTE_EVENT_TYPES.StageChanged)?.(
        event(DISPUTE_EVENT_TYPES.StageChanged, { disputeId: 'dsp-1' }),
      ),
    ).rejects.toThrow();
  });
});

describe('SLA breached', () => {
  it('tells the customer the dispute has passed its deadline, in their current stage', async () => {
    const { handlers, notifications } = setup();

    await handlers.get(DISPUTE_EVENT_TYPES.SlaBreached)?.(
      event(DISPUTE_EVENT_TYPES.SlaBreached, {
        disputeId: 'dsp-1',
        reference: 'DSP-ABC123XY',
        customerId: 'cus-1',
        stage: 'investigating',
        slaDueAt: '2026-08-01T00:00:00.000Z',
        amount: AMOUNT,
      }),
    );

    expect(notifications.notify).toHaveBeenCalledWith(
      'dispute_update',
      'cus-1',
      expect.objectContaining({
        reference: 'DSP-ABC123XY',
        status: 'investigating',
        amount: AMOUNT,
      }),
    );
    const detail = notifications.notify.mock.calls[0]?.[2]?.detail as string;
    expect(detail).toContain('longer than the deadline');
  });
});
