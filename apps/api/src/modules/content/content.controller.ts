import {
  faqQuerySchema,
  type ContentLocationView,
  type FaqArticleView,
  type RateTable,
} from '@icb/contracts';
import { Controller, Get, Query } from '@nestjs/common';

import { Public } from '../../common/decorators/public.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { ContentRatesService } from './application/content-rates.service.js';
import { FaqService } from './application/faq.service.js';
import { LocationService } from './application/location.service.js';

/**
 * The public content surface.
 *
 * No token: the marketing site reads help articles, branch listings and the rate table
 * anonymously, the same way it reads `/products/rates`. Only published articles and active
 * locations ever leave through here — the staff controller is the only one that sees drafts.
 */
@Controller('content')
export class ContentController {
  constructor(
    private readonly faq: FaqService,
    private readonly locations: LocationService,
    private readonly rates: ContentRatesService,
  ) {}

  @Public()
  @Get('faq')
  listPublishedFaq(
    @Query(new ZodValidationPipe(faqQuerySchema))
    query: ReturnType<typeof faqQuerySchema.parse>,
  ): Promise<FaqArticleView[]> {
    return this.faq.listPublished(query.category);
  }

  @Public()
  @Get('locations')
  listActiveLocations(): Promise<ContentLocationView[]> {
    return this.locations.listActive();
  }

  /** The catalogue rate table with content-managed entries layered over it. */
  @Public()
  @Get('rates')
  layeredRateTable(): Promise<RateTable> {
    return this.rates.getLayeredRateTable();
  }
}
