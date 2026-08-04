import { Controller, Get, Header } from '@nestjs/common';
import promClient from 'prom-client';

import { Public } from '../decorators/public.decorator.js';
import { MetricsService } from './metrics.service.js';

/**
 * The Prometheus scrape endpoint.
 *
 * Public like the other probes: the scrape comes from inside the platform, and putting it
 * behind customer auth would mean either handing the monitoring stack a customer token or
 * weakening the guard for a machine. It is excluded from the `/v1` prefix for the same reason —
 * it is platform surface, not API surface.
 */
@Public()
@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('metrics')
  @Header('content-type', promClient.Registry.PROMETHEUS_CONTENT_TYPE)
  scrape(): Promise<string> {
    return this.metrics.render();
  }
}
