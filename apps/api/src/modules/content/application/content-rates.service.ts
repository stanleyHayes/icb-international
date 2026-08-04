import {
  rateTableSchema,
  type RateEntryUpsertRequest,
  type RateEntryView,
  type RateTable,
} from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { CacheService } from '../../../infrastructure/cache/cache.service.js';
import { isDuplicateKeyError } from '../../../infrastructure/database/mongo-errors.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import { buildRateTable } from '../../products/application/rate-table.js';
import { ProductDoc } from '../../products/infrastructure/product.schemas.js';
import {
  CONTENT_CACHE_NAMESPACE,
  RATE_TABLE_CACHE_KEY,
  RATE_TABLE_TTL_SECONDS,
} from '../content.constants.js';
import { overlayRateEntries } from '../domain/rate-overlay.js';
import { toRateEntryView } from '../infrastructure/content.mapper.js';
import { ContentRateEntryDoc } from '../infrastructure/content.schemas.js';

/**
 * Marketing rate-table entries.
 *
 * Entries override or extend the catalogue-built public table by product code: a code the
 * catalogue publishes has its savings rate replaced, a code it does not know is appended.
 * The catalogue stays the source of truth for products themselves — a content entry can put a
 * promotional rate on the public site without a catalogue deploy, nothing more.
 *
 * `ProductDoc` is registered read-only, the same way support reads `CustomerDoc`.
 */
@Injectable()
export class ContentRatesService {
  constructor(
    @InjectModel(ContentRateEntryDoc.name) private readonly entries: Model<ContentRateEntryDoc>,
    @InjectModel(ProductDoc.name) private readonly products: Model<ProductDoc>,
    private readonly cache: CacheService,
    private readonly clock: ClockService,
  ) {}

  async list(): Promise<RateEntryView[]> {
    const rows = await this.entries.find().sort({ productCode: 1 }).lean();
    return rows.map(toRateEntryView);
  }

  /** One entry per product code — a second write for the same code replaces the first. */
  async upsert(staff: AccessTokenClaims, request: RateEntryUpsertRequest): Promise<RateEntryView> {
    const now = this.clock.now();
    try {
      const saved = await this.entries
        .findOneAndUpdate(
          { productCode: request.productCode },
          {
            $set: {
              name: request.name,
              rate: request.rate,
              effectiveFrom: new Date(request.effectiveFrom),
              createdBy: staff.sub,
              updatedAt: now,
            },
            $setOnInsert: { createdAt: now },
          },
          { new: true, upsert: true },
        )
        .lean();
      await this.invalidate();
      return toRateEntryView(saved);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictError('A rate entry for this product code already exists', {
          productCode: request.productCode,
        });
      }
      throw error;
    }
  }

  async remove(entryId: string): Promise<void> {
    const result = await this.entries.deleteOne({ _id: entryId });
    if (result.deletedCount === 0) {
      throw new NotFoundError('Rate entry', entryId);
    }
    await this.invalidate();
  }

  /**
   * The public table with content entries layered on, cached.
   *
   * This is the single assembly point for every public rate table: the content vertical's own
   * `/content/rates` and the products vertical's `/products/rates` both serve from here, so a
   * promotional entry reaches both endpoints and one invalidation clears both.
   */
  async getLayeredRateTable(): Promise<RateTable> {
    const cached = await this.cache.get(
      CONTENT_CACHE_NAMESPACE,
      RATE_TABLE_CACHE_KEY,
      rateTableSchema,
    );
    if (cached !== null) {
      return cached;
    }
    const table = await this.assemble();
    await this.cache.set(CONTENT_CACHE_NAMESPACE, RATE_TABLE_CACHE_KEY, table, RATE_TABLE_TTL_SECONDS);
    return table;
  }

  private async assemble(): Promise<RateTable> {
    const now = this.clock.now();
    const docs = await this.products.find({ active: true }).lean();
    const entries = await this.entries.find().lean();
    return overlayRateEntries(buildRateTable(docs, now), entries, now);
  }

  /** Drop the cached table after any content-entry or catalogue write. */
  async invalidate(): Promise<void> {
    await this.cache.delete(CONTENT_CACHE_NAMESPACE, RATE_TABLE_CACHE_KEY);
  }
}
