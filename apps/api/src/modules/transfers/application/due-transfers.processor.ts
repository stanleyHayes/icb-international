import { Injectable, type OnModuleInit } from '@nestjs/common';

import { OutboxConsumerService } from '../../../infrastructure/outbox/outbox-consumer.service.js';
import { DUE_TRANSFER_CONSUMER, TRANSFER_EVENTS } from '../domain/transfers.constants.js';
import { ScheduledTransfersExecutor } from './scheduled-transfers.executor.js';

/**
 * Wakes scheduled transfers up.
 *
 * Creation publishes a `transfer_due` event available at the execution instant; the outbox drain
 * delivers it once that instant passes and this consumer runs the transfer. Registration happens
 * here rather than in a module hook so the wiring is visible next to the handler.
 */
@Injectable()
export class DueTransfersProcessor implements OnModuleInit {
  constructor(
    private readonly consumer: OutboxConsumerService,
    private readonly executor: ScheduledTransfersExecutor,
  ) {}

  onModuleInit(): void {
    this.consumer.register(TRANSFER_EVENTS.due, DUE_TRANSFER_CONSUMER, (event) => {
      const transferId = event.payload['transferId'];
      if (typeof transferId === 'string' && transferId.length > 0) {
        return this.executor.executeDue(transferId);
      }
      return Promise.resolve();
    });
  }
}
