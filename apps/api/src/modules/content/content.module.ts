import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CacheModule } from '../../infrastructure/cache/cache.module.js';
import { ProductDoc, ProductSchema } from '../products/infrastructure/product.schemas.js';
import { ContentRatesService } from './application/content-rates.service.js';
import { FaqService } from './application/faq.service.js';
import { LocationService } from './application/location.service.js';
import { TemplateOverrideService } from './application/template-override.service.js';
import { ContentStaffController } from './content-staff.controller.js';
import { ContentController } from './content.controller.js';
import {
  ContentArticleDoc,
  ContentArticleSchema,
  ContentLocationDoc,
  ContentLocationSchema,
  ContentRateEntryDoc,
  ContentRateEntrySchema,
  ContentTemplateOverrideDoc,
  ContentTemplateOverrideSchema,
} from './infrastructure/content.schemas.js';

/**
 * Content management (agent_plan.md ADM-15).
 *
 * Four collections behind one staff controller: FAQ/help articles, branch & ATM records,
 * notification template overrides, and marketing rate-table entries. The public controller
 * serves published articles, active locations and the rate table with content entries layered
 * over the catalogue — `ProductDoc` is registered read-only for that assembly, the same way
 * support reads `CustomerDoc`.
 *
 * `ContentRatesService` is exported and consumed by the products vertical: `/products/rates`
 * serves the same layered table via `RatesService`, so both public endpoints share one
 * assembly and one cache.
 */
@Module({
  imports: [
    CacheModule,
    MongooseModule.forFeature([
      { name: ContentArticleDoc.name, schema: ContentArticleSchema },
      { name: ContentLocationDoc.name, schema: ContentLocationSchema },
      { name: ContentTemplateOverrideDoc.name, schema: ContentTemplateOverrideSchema },
      { name: ContentRateEntryDoc.name, schema: ContentRateEntrySchema },
      { name: ProductDoc.name, schema: ProductSchema },
    ]),
  ],
  controllers: [ContentController, ContentStaffController],
  providers: [FaqService, LocationService, TemplateOverrideService, ContentRatesService],
  exports: [ContentRatesService],
})
export class ContentModule {}
