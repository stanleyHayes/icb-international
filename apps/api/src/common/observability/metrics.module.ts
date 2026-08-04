import { Global, Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { MetricsController } from './metrics.controller.js';
import { MetricsService } from './metrics.service.js';
import { QueueDepthCollector } from './queue-depth.collector.js';

/**
 * Metrics wiring.
 *
 * Global because the instrumented code is everywhere — the ledger, the risk engine, the
 * transfer pipeline — and a metrics import in twenty modules is twenty chances for a circular
 * dependency, for zero benefit. The controller serves `/metrics` (excluded from the `/v1`
 * prefix in main.ts); the collector feeds the queue gauges.
 */
@Global()
@Module({
  imports: [DiscoveryModule],
  controllers: [MetricsController],
  providers: [MetricsService, QueueDepthCollector],
  exports: [MetricsService],
})
export class MetricsModule {}
