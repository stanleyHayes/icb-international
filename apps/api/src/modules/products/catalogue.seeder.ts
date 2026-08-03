import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ProductDoc } from './infrastructure/product.schemas.js';
import { buildCatalogueSeed } from './products.constants.js';

/**
 * Seeds the catalogue from the hardcoded products in `simulation/seed/seed.data.ts`.
 *
 * Inserts are `$setOnInsert` upserts: a catalogue the staff have since edited is never
 * clobbered, and a re-run is a no-op. A failed seed (database not yet reachable at boot) is a
 * warning, not a crash — the catalogue can also be seeded by the full SIM-04 seed run, and a
 * read-only marketing deployment must still boot without it.
 */
@Injectable()
export class CatalogueSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(CatalogueSeeder.name);

  constructor(@InjectModel(ProductDoc.name) private readonly products: Model<ProductDoc>) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      const seeded = await this.ensureSeeded();
      if (seeded > 0) {
        this.logger.log({ seeded }, 'Product catalogue seeded');
      }
    } catch (error) {
      this.logger.warn({ err: error }, 'Product catalogue seed skipped — database unavailable');
    }
  }

  /** Upsert every seed product. Returns how many were newly inserted. */
  async ensureSeeded(): Promise<number> {
    let inserted = 0;
    for (const definition of buildCatalogueSeed()) {
      const result = await this.products.updateOne(
        { code: definition.code },
        { $setOnInsert: definition },
        { upsert: true },
      );
      inserted += result.upsertedCount;
    }
    return inserted;
  }
}
