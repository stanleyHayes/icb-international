import { getConnectionToken } from '@nestjs/mongoose';
import { Test, type TestingModule } from '@nestjs/testing';
import mongoose from 'mongoose';
import { afterAll, describe, expect, it } from 'vitest';

import { AppModule } from './app.module.js';
import { IDEMPOTENCY_STORE } from './common/interceptors/idempotency-store.port.js';
import { OutboxDrainProcessor } from './infrastructure/outbox/outbox-drain.processor.js';
import { OutboxService } from './infrastructure/outbox/outbox.service.js';

/** A connection object that never connects: DI gets models, nothing waits on a server. */
function offlineConnection(): mongoose.Connection {
  const connection = mongoose.createConnection('mongodb://127.0.0.1:1/icb-offline', {
    serverSelectionTimeoutMS: 500,
  });
  connection.on('error', () => undefined); // Expected: there is no server on port 1.
  return connection;
}

/**
 * Composition smoke test.
 *
 * The real connection factory awaits a live Mongo, so it is replaced with an unconnected
 * connection object; `compile()` then resolves and instantiates the entire dependency graph —
 * every module, controller, guard and interceptor — without a database. A missing provider, an
 * unexported token, or a circular dependency anywhere in the 25 modules fails this test in
 * seconds rather than at the next deploy.
 */
describe('AppModule wiring (offline)', () => {
  let moduleRef: TestingModule | undefined;

  afterAll(async () => {
    await moduleRef?.close();
  });

  it('resolves the full DI graph without a database', async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getConnectionToken())
      .useFactory({ factory: offlineConnection })
      .compile();

    expect(moduleRef.get(IDEMPOTENCY_STORE, { strict: false })).toBeDefined();
    expect(moduleRef.get(OutboxService, { strict: false })).toBeDefined();
    expect(moduleRef.get(OutboxDrainProcessor, { strict: false })).toBeDefined();
  }, 120_000);
});
