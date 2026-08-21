import { Global, Module } from '@nestjs/common';

import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';

/**
 * Metrics wiring.
 *
 * Global because the instrumented code is everywhere — the ledger, the risk engine, the
 * transfer pipeline — and a metrics import in twenty modules is twenty chances for a circular
 * dependency, for zero benefit. The controller serves `/metrics` (excluded from the `/v1`
 * prefix in main.ts).
 */
@Global()
@Module({
  controllers: [MetricsController],
  providers: [MetricsService],
  exports: [MetricsService],
})
export class MetricsModule {}
