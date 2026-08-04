import { beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  OutboxEvent,
  OutboxEventHandler,
} from '../../../../infrastructure/outbox/outbox-consumer.service.js';
import { type OutboxConsumerService } from '../../../../infrastructure/outbox/outbox-consumer.service.js';
import { DUE_TRANSFER_CONSUMER, TRANSFER_EVENTS } from '../../domain/transfers.constants.js';
import type { ScheduledTransfersExecutor } from '../scheduled-transfers.executor.js';
import { DueTransfersProcessor } from '../due-transfers.processor.js';

/** A due event is published inside the request that scheduled the transfer, so it is correlated. */
function event(payload: Record<string, unknown>): OutboxEvent {
  return { id: 'evt-1', type: TRANSFER_EVENTS.due, payload, attempts: 1, correlationId: 'corr-1' };
}

function setup() {
  const register = vi.fn();
  const consumer = { register } as unknown as OutboxConsumerService;
  const executeDue = vi.fn().mockResolvedValue(undefined);
  const executor = { executeDue } as unknown as ScheduledTransfersExecutor;
  const processor = new DueTransfersProcessor(consumer, executor);

  processor.onModuleInit();
  const handler = register.mock.calls[0]?.[2] as OutboxEventHandler;
  return { register, executeDue, handler };
}

describe('DueTransfersProcessor', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('registers a consumer for transfer_due events', () => {
    expect(context.register).toHaveBeenCalledWith(
      TRANSFER_EVENTS.due,
      DUE_TRANSFER_CONSUMER,
      expect.any(Function),
    );
  });

  it('executes the transfer named in the event payload', async () => {
    await context.handler(event({ transferId: 'tr-1' }));

    expect(context.executeDue).toHaveBeenCalledWith('tr-1');
  });

  it('ignores an event without a transfer id', async () => {
    await context.handler(event({}));

    expect(context.executeDue).not.toHaveBeenCalled();
  });

  it('ignores an event whose transfer id is not a usable string', async () => {
    await context.handler(event({ transferId: 42 }));
    await context.handler(event({ transferId: '' }));

    expect(context.executeDue).not.toHaveBeenCalled();
  });
});
