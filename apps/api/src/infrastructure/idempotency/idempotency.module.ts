import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { IDEMPOTENCY_STORE } from '../../common/interceptors/idempotency-store.port.js';
import { MongoIdempotencyStore } from './idempotency-store.service.js';
import { IdempotencyRecordDoc, IdempotencyRecordSchema } from './idempotency.schemas.js';

/**
 * Durable idempotency records (N6).
 *
 * Binds the `IDEMPOTENCY_STORE` port the `IdempotencyInterceptor` injects. The interceptor
 * itself is registered globally in the composition root, alongside the other cross-cutting
 * interceptors, so its position in the execution order is visible in one place.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: IdempotencyRecordDoc.name, schema: IdempotencyRecordSchema },
    ]),
  ],
  providers: [{ provide: IDEMPOTENCY_STORE, useClass: MongoIdempotencyStore }],
  exports: [IDEMPOTENCY_STORE],
})
export class IdempotencyModule {}
