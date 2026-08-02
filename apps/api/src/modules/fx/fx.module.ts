import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import {
  CustomerDoc,
  CustomerSchema,
} from '../customers/infrastructure/customer.schemas.js';
import { CustomerTierReader } from './application/customer-tier.reader.js';
import { FxConversionService } from './fx-conversion.service.js';
import { FxController } from './fx.controller.js';
import { FxQuotesService } from './fx-quotes.service.js';
import { FxRatesService } from './fx-rates.service.js';
import {
  FxQuoteDoc,
  FxQuoteSchema,
  FxRateDoc,
  FxRateSchema,
} from './infrastructure/fx.schemas.js';

/**
 * Foreign exchange.
 *
 * `FxConversionService` and `FxQuotesService` are exported because a cross-currency transfer is
 * assembled elsewhere: it redeems the quote, converts through this module, and posts the lines
 * this module builds. Keeping the rate, the spread and the rounding leg in one place is what
 * stops a second, subtly different FX implementation growing inside the transfers module.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: FxRateDoc.name, schema: FxRateSchema },
      { name: FxQuoteDoc.name, schema: FxQuoteSchema },
      { name: CustomerDoc.name, schema: CustomerSchema },
    ]),
  ],
  controllers: [FxController],
  providers: [FxRatesService, FxQuotesService, FxConversionService, CustomerTierReader],
  exports: [FxRatesService, FxQuotesService, FxConversionService, MongooseModule],
})
export class FxModule {}
