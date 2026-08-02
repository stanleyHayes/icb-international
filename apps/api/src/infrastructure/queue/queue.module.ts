import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';

import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { DEAD_LETTER_QUEUE, DEFAULT_JOB_OPTIONS } from './queue.constants.js';

/**
 * BullMQ root.
 *
 * Domain modules register their own queues with `BullModule.registerQueue({ name })` and build
 * workers by extending BaseJobProcessor. `maxRetriesPerRequest: null` is required by BullMQ:
 * its blocking commands must never be failed by ioredis's per-request retry cap.
 */
@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [CONFIG],
      useFactory: (config: AppConfiguration) => ({
        connection: { url: config.redis.url, maxRetriesPerRequest: null },
        defaultJobOptions: DEFAULT_JOB_OPTIONS,
      }),
    }),
    BullModule.registerQueue({ name: DEAD_LETTER_QUEUE }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
