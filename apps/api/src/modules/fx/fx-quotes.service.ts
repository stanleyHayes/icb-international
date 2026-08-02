import type { FxQuote } from '@icb/contracts';
import { applySpread, fromMinorUnits, type CurrencyCode, type Money } from '@icb/money';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError, NotFoundError, ValidationError } from '../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { CustomerTierReader } from './application/customer-tier.reader.js';
import {
  QuoteAlreadyUsedError,
  QuoteExpiredError,
  QuoteSignatureInvalidError,
} from './domain/fx-errors.js';
import { signQuote, verifyQuote, type SignedQuoteTerms } from './domain/quote-signature.js';
import { FxConversionService } from './fx-conversion.service.js';
import { FxRatesService } from './fx-rates.service.js';
import {
  buildQuoteDocument,
  type FxQuoteRequest,
  type NewQuote,
  type PricedQuote,
} from './infrastructure/fx-quote.factory.js';
import { toFxQuote } from './infrastructure/fx.mapper.js';
import { FxQuoteDoc, QUOTE_STATUSES } from './infrastructure/fx.schemas.js';

/** Ninety seconds: long enough to read a confirmation screen, short enough to be a real price. */
export const FX_QUOTE_TTL_SECONDS = 90;

const MS_PER_SECOND = 1000;

/** What a caller needs to actually post the conversion once the quote is spent. */
export interface RedeemedQuote {
  readonly quoteId: string;
  readonly from: Money;
  readonly to: Money;
  readonly rate: number;
  readonly roundingDelta: number;
}

/**
 * Issuing and spending price commitments.
 *
 * A quote is single-use and time-boxed, and both properties are enforced by one conditional
 * update rather than by a read followed by a write — two clicks on a confirm button must not
 * deal twice at a rate the market has since left behind.
 */
@Injectable()
export class FxQuotesService {
  private readonly logger = new Logger(FxQuotesService.name);

  constructor(
    @InjectModel(FxQuoteDoc.name) private readonly quotes: Model<FxQuoteDoc>,
    private readonly rates: FxRatesService,
    private readonly conversion: FxConversionService,
    private readonly tiers: CustomerTierReader,
    private readonly clock: ClockService,
    @Inject(CONFIG) private readonly config: AppConfiguration,
  ) {}

  async issue(customerId: string, request: FxQuoteRequest): Promise<FxQuote> {
    if (request.from === request.to) {
      throw new ValidationError('A quote needs two different currencies', [
        { path: 'to', message: `Cannot quote ${request.from} against itself` },
      ]);
    }

    const spreadBps = await this.tiers.spreadBpsFor(customerId);
    const issuedAt = this.clock.now();
    const midRate = this.rates.midFor(request.from, request.to, issuedAt);
    const rate = applySpread(midRate, spreadBps, 'customer-buys');
    const priced = this.price(request, rate);

    const doc = await this.persist({ customerId, request, priced, rate, midRate, spreadBps, issuedAt });
    this.logger.log({ quoteId: doc._id, pair: `${request.from}/${request.to}` }, 'FX quote issued');
    return toFxQuote(doc, issuedAt);
  }

  /**
   * Which side of the trade the customer fixed.
   *
   * Selling fixes what leaves their account; buying fixes what arrives. The buy case converts
   * backwards at the reciprocal rate, which is why the rounding remainder lands in the source
   * currency there and the target currency here — the caller is told either way.
   */
  private price(request: FxQuoteRequest, rate: number): PricedQuote {
    if (request.amountSide === 'sell') {
      const from = fromMinorUnits(request.amountMinorUnits, request.from);
      const result = this.conversion.convertMoney(from, request.to, rate);
      return { from, to: result.converted, roundingDelta: result.roundingDelta };
    }

    const to = fromMinorUnits(request.amountMinorUnits, request.to);
    const result = this.conversion.convertMoney(to, request.from, 1 / rate);
    return { from: result.converted, to, roundingDelta: result.roundingDelta };
  }

  private async persist(input: NewQuote): Promise<FxQuoteDoc> {
    const quoteId = newId();
    const expiresAt = new Date(input.issuedAt.getTime() + FX_QUOTE_TTL_SECONDS * MS_PER_SECOND);
    const terms: SignedQuoteTerms = {
      quoteId,
      customerId: input.customerId,
      from: input.request.from,
      to: input.request.to,
      fromMinorUnits: input.priced.from.minorUnits,
      toMinorUnits: input.priced.to.minorUnits,
      rate: input.rate,
      expiresAtMs: expiresAt.getTime(),
    };

    const document = buildQuoteDocument(input, terms, signQuote(this.key(), terms));
    const [created] = await this.quotes.create([document], { ordered: true });

    if (!created) {
      throw new ConflictError('The quote could not be issued');
    }
    return created;
  }

  /** Reading a quote answers "can I still use this?", so a dead quote is an error, not a payload. */
  async get(customerId: string, quoteId: string): Promise<FxQuote> {
    const doc = await this.load(customerId, quoteId);
    await this.assertLive(doc);
    return toFxQuote(doc, this.clock.now());
  }

  /**
   * Spend the quote. The conditional update is the whole control: only a row that is still
   * `issued` and still in date can transition, so a double submit loses the race rather than
   * dealing twice.
   */
  async redeem(customerId: string, quoteId: string, transactionId?: string): Promise<RedeemedQuote> {
    const doc = await this.load(customerId, quoteId);
    await this.assertLive(doc);
    this.assertSignature(doc);

    const now = this.clock.now();
    const redeemed = await this.quotes
      .findOneAndUpdate(
        { _id: quoteId, customerId, status: QUOTE_STATUSES.ISSUED, expiresAt: { $gt: now } },
        {
          $set: {
            status: QUOTE_STATUSES.REDEEMED,
            redeemedAt: now,
            redeemedTransactionId: transactionId ?? null,
          },
        },
        { new: true },
      )
      .lean();

    if (!redeemed) {
      throw new QuoteAlreadyUsedError(quoteId, doc.redeemedAt);
    }

    this.logger.log({ quoteId, transactionId: transactionId ?? null }, 'FX quote redeemed');
    return {
      quoteId,
      from: fromMinorUnits(redeemed.fromMinorUnits, redeemed.fromCurrency as CurrencyCode),
      to: fromMinorUnits(redeemed.toMinorUnits, redeemed.toCurrency as CurrencyCode),
      rate: redeemed.rate,
      roundingDelta: redeemed.roundingDelta,
    };
  }

  private async load(customerId: string, quoteId: string): Promise<FxQuoteDoc> {
    const doc = await this.quotes.findOne({ _id: quoteId, customerId }).lean();
    if (!doc) {
      throw new NotFoundError('FX quote', quoteId);
    }
    return doc;
  }

  /** Expiry is recorded when it is noticed, so the collection reflects what actually happened. */
  private async assertLive(doc: FxQuoteDoc): Promise<void> {
    if (doc.status === QUOTE_STATUSES.REDEEMED) {
      throw new QuoteAlreadyUsedError(doc._id, doc.redeemedAt);
    }
    if (doc.expiresAt.getTime() <= this.clock.epochMs()) {
      await this.quotes.updateOne(
        { _id: doc._id, status: QUOTE_STATUSES.ISSUED },
        { $set: { status: QUOTE_STATUSES.EXPIRED } },
      );
      throw new QuoteExpiredError(doc._id, doc.expiresAt);
    }
  }

  private assertSignature(doc: FxQuoteDoc): void {
    const terms: SignedQuoteTerms = {
      quoteId: doc._id,
      customerId: doc.customerId,
      from: doc.fromCurrency,
      to: doc.toCurrency,
      fromMinorUnits: doc.fromMinorUnits,
      toMinorUnits: doc.toMinorUnits,
      rate: doc.rate,
      expiresAtMs: doc.expiresAt.getTime(),
    };
    if (!verifyQuote(this.key(), terms, doc.signature)) {
      throw new QuoteSignatureInvalidError(doc._id);
    }
  }

  private key(): string {
    return this.config.crypto.fieldEncryptionKey;
  }
}
