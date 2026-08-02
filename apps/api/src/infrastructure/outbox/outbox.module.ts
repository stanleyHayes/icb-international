import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { OutboxConsumerService } from './outbox-consumer.service.js';
import { OutboxDrainProcessor } from './outbox-drain.processor.js';
import {
  OutboxDeliveryDoc,
  OutboxDeliverySchema,
  OutboxEventDoc,
  OutboxEventSchema,
} from './outbox.schemas.js';
import { OutboxService } from './outbox.service.js';

/**
 * Transactional outbox.
 *
 * Producers inject OutboxService and publish inside their Mongo transaction; consumers register
 * a handler per event type on OutboxConsumerService at boot. The drain processor bridges the
 * two with at-least-once delivery.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: OutboxEventDoc.name, schema: OutboxEventSchema },
      { name: OutboxDeliveryDoc.name, schema: OutboxDeliverySchema },
    ]),
  ],
  providers: [OutboxService, OutboxConsumerService, OutboxDrainProcessor],
  exports: [OutboxService, OutboxConsumerService],
})
export class OutboxModule {}
