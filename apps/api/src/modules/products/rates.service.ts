import { rateTableSchema, type RateTable } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { CacheService } from '../../infrastructure/cache/cache.service.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { buildRateTable } from './application/rate-table.js';
import { ProductDoc } from './infrastructure/product.schemas.js';
import { CACHE_NAMESPACE, RATE_TABLE_CACHE_KEY, RATE_TABLE_TTL_SECONDS } from './products.constants.js';

/**
 * The public rates table, cached.
 *
 * The marketing site polls this endpoint, so the assembled table is cached for
 * `RATE_TABLE_TTL_SECONDS` via the shared CacheService — which degrades to a no-op without
 * Redis, in which case every request recomputes (correct, just uncached). Any staff write to
 * the catalogue invalidates the key so a rate change is never served stale for a whole TTL.
 */
@Injectable()
export class RatesService {
  constructor(
    @InjectModel(ProductDoc.name) private readonly products: Model<ProductDoc>,
    private readonly cache: CacheService,
    private readonly clock: ClockService,
  ) {}

  async getRateTable(): Promise<RateTable> {
    const cached = await this.cache.get(CACHE_NAMESPACE, RATE_TABLE_CACHE_KEY, rateTableSchema);
    if (cached !== null) {
      return cached;
    }
    const table = await this.assemble();
    await this.cache.set(CACHE_NAMESPACE, RATE_TABLE_CACHE_KEY, table, RATE_TABLE_TTL_SECONDS);
    return table;
  }

  /** Drop the cached table after any catalogue or rate-schedule write. */
  async invalidate(): Promise<void> {
    await this.cache.delete(CACHE_NAMESPACE, RATE_TABLE_CACHE_KEY);
  }

  private async assemble(): Promise<RateTable> {
    const docs = await this.products.find({ active: true }).lean();
    return buildRateTable(docs, this.clock.now());
  }
}
