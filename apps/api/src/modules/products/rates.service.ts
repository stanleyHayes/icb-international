import { type RateTable } from '@icb/contracts';
import { Injectable } from '@nestjs/common';

import { ContentRatesService } from '../content/application/content-rates.service.js';

/**
 * The public rates table.
 *
 * The table is assembled once, by the content vertical: the catalogue build with any
 * content-managed rate entries layered over it, cached there. This service stays the
 * products-facing handle so catalogue writes keep a single invalidation point — a staff
 * catalogue change and a content rate entry now reach `/products/rates` through the same path.
 */
@Injectable()
export class RatesService {
  constructor(private readonly contentRates: ContentRatesService) {}

  getRateTable(): Promise<RateTable> {
    return this.contentRates.getLayeredRateTable();
  }

  /** Drop the cached layered table after any catalogue or rate-schedule write. */
  async invalidate(): Promise<void> {
    await this.contentRates.invalidate();
  }
}
