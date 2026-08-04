import { fxQuoteRequestSchema, type FxQuote, type FxRate } from '@icb/contracts';
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { CustomerTierReader } from './application/customer-tier.reader.js';
import { parsePair } from './domain/fx-pair.js';
import { FxQuotesService } from './fx-quotes.service.js';
import { FxRatesService } from './fx-rates.service.js';

/**
 * How much of the series to draw. Not a contract DTO — these are chart controls, and putting
 * them in `@icb/contracts` would freeze a presentation choice into the shared vocabulary.
 */
const historyQuerySchema = z.object({
  points: z.coerce.number().int().min(2).max(180).optional(),
  hours: z.coerce.number().int().min(1).max(720).optional(),
});

/** A pair plus its recent past, which is what a rate screen actually needs to render. */
export interface FxRateDetail {
  rate: FxRate;
  history: FxRate[];
}

/**
 * Rates are quoted at the caller's own spread, so the board a customer sees is the board they
 * can actually deal on — a private-tier customer is not shown a standard-tier price and then
 * charged differently at confirmation.
 */
@Controller('fx')
export class FxController {
  constructor(
    private readonly rates: FxRatesService,
    private readonly quotes: FxQuotesService,
    private readonly tiers: CustomerTierReader,
  ) {}

  /** A bare array, not `{ items }`: the board is a fixed set of pairs, never paginated. */
  @Get('rates')
  async list(@CurrentCustomer() customerId: string): Promise<FxRate[]> {
    const spreadBps = await this.tiers.spreadBpsFor(customerId);
    return this.rates.list(spreadBps);
  }

  /**
   * A slash cannot survive a path segment, so the pair arrives as `EUR-USD` or `EURUSD` and is
   * normalised by `parsePair`.
   */
  @Get('rates/:pair')
  async detail(
    @CurrentCustomer() customerId: string,
    @Param('pair') pair: string,
    @Query(new ZodValidationPipe(historyQuerySchema))
    query: ReturnType<typeof historyQuerySchema.parse>,
  ): Promise<FxRateDetail> {
    const spreadBps = await this.tiers.spreadBpsFor(customerId);
    const parsed = parsePair(pair);

    return {
      rate: await this.rates.get(parsed, spreadBps),
      history: this.rates.history(parsed, { spreadBps, ...query }),
    };
  }

  // `quotes`, plural, to match the published contract and the SDK — which were both calling a
  // path this controller did not serve, so every SDK quote request 404'd.
  @Post('quotes')
  async quote(
    @CurrentCustomer() customerId: string,
    @Body(zodBody(fxQuoteRequestSchema))
    body: ReturnType<typeof fxQuoteRequestSchema.parse>,
  ): Promise<FxQuote> {
    return this.quotes.issue(customerId, body);
  }

  @Get('quotes/:quoteId')
  async getQuote(
    @CurrentCustomer() customerId: string,
    @Param('quoteId') quoteId: string,
  ): Promise<FxQuote> {
    return this.quotes.get(customerId, quoteId);
  }
}
