import type {
  TransferDestination,
  TransferQuote,
  TransferQuoteRequest,
  TransferRail,
} from '@icb/contracts';
import { fromMinorUnits, type CurrencyCode, type Money } from '@icb/money';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ValidationError } from '../../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import { newId } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { AccountsService } from '../../accounts/accounts.service.js';
import { assertRailCompatible, resolveRail } from '../domain/rail-resolver.js';
import {
  destinationFingerprint,
  signTransferQuote,
  type SignedTransferQuoteTerms,
} from '../domain/quote-signature.js';
import { feesFor, totalFees, type FeeLine } from '../domain/transfer-fees.js';
import {
  APPROVAL_THRESHOLD_MAJOR_UNITS,
  STEP_UP_THRESHOLD_MAJOR_UNITS,
  TRANSFER_QUOTE_TTL_MS,
} from '../domain/transfers.constants.js';
import {
  thresholdMinorUnits,
  toQuoteContract,
  type RedeemedTransferQuote,
} from '../infrastructure/transfer-quote.mapper.js';
import {
  TRANSFER_QUOTE_STATUSES,
  TransferQuoteDoc,
} from '../infrastructure/transfer-quote.schemas.js';
import { DestinationResolver } from './destination-resolver.js';
import { TRANSFER_PRICING, type TransferPricing } from './transfer-pricing.js';

export type { RedeemedTransferQuote };

interface PersistInput {
  readonly quoteId: string;
  readonly customerId: string;
  readonly request: TransferQuoteRequest;
  readonly destination: TransferDestination;
  readonly rail: TransferRail;
  readonly priced: { debit: Money; credit: Money; fx: RedeemedTransferQuote['fx'] };
  readonly fees: readonly FeeLine[];
  readonly estimate: { settlesAt: Date; cutOffAt: Date | null };
  readonly expiresAt: Date;
  readonly now: Date;
}

/**
 * Transfer quotes: what a transfer would cost, committed to for five minutes.
 *
 * A quote fixes the amounts in both directions, the fee, the rail and the arrival estimate, and
 * signs all of it — the price the customer was shown is the price they get. Issuing lives here;
 * spending (redemption, binding checks, step-up) lives in `TransferQuoteRedemptionService`.
 */
@Injectable()
export class TransferQuotesService {
  private readonly logger = new Logger(TransferQuotesService.name);

  constructor(
    @InjectModel(TransferQuoteDoc.name) private readonly quotes: Model<TransferQuoteDoc>,
    private readonly accounts: AccountsService,
    private readonly destinations: DestinationResolver,
    @Inject(TRANSFER_PRICING) private readonly pricing: TransferPricing,
    private readonly clock: ClockService,
    @Inject(CONFIG) private readonly config: AppConfiguration,
  ) {}

  async issue(customerId: string, request: TransferQuoteRequest): Promise<TransferQuote> {
    const source = await this.accounts.loadSpendable(request.fromAccountId, customerId);
    const resolved = await this.destinations.resolve(request.destination, customerId);
    const rail = request.rail ?? resolveRail(resolved.destination);
    assertRailCompatible(rail, resolved.destination);

    const priced = await this.price(customerId, request, source.currency as CurrencyCode);
    const fees = feesFor(rail, priced.debit.currency);
    const now = this.clock.now();
    const estimate = await this.pricing.rails.estimate(rail, now);

    const quoteId = newId();
    const doc = await this.persist({
      quoteId, customerId, request, destination: resolved.destination,
      rail, priced, fees, estimate,
      expiresAt: new Date(now.getTime() + TRANSFER_QUOTE_TTL_MS), now,
    });

    this.logger.log({ quoteId, rail }, 'Transfer quote issued');
    return toQuoteContract(doc, {
      stepUpMinorUnits: thresholdMinorUnits(STEP_UP_THRESHOLD_MAJOR_UNITS, priced.debit.currency),
      approvalMinorUnits: thresholdMinorUnits(APPROVAL_THRESHOLD_MAJOR_UNITS, priced.debit.currency),
    });
  }

  /** Price both directions. Cross-currency is fixed credit-side via the FX module's pricing. */
  private async price(
    customerId: string,
    request: TransferQuoteRequest,
    sourceCurrency: CurrencyCode,
  ): Promise<{ debit: Money; credit: Money; fx: RedeemedTransferQuote['fx'] }> {
    const amount = fromMinorUnits(request.amount.minorUnits, request.amount.currency);
    if (request.amount.currency === sourceCurrency) {
      return { debit: amount, credit: amount, fx: null };
    }
    if (request.amountSide === 'debit') {
      throw new ValidationError(
        'A cross-currency quote must fix the amount the recipient receives',
        [{ path: 'amountSide', message: 'Use amountSide credit for a cross-currency quote' }],
      );
    }

    const fxQuote = await this.pricing.fxQuotes.issue(customerId, {
      from: sourceCurrency,
      to: request.amount.currency,
      amountMinorUnits: request.amount.minorUnits,
      amountSide: 'buy',
    });
    return {
      debit: fromMinorUnits(fxQuote.from.minorUnits, sourceCurrency),
      credit: amount,
      fx: { rate: fxQuote.rate, spreadBps: fxQuote.spreadBps, roundingDelta: 0 },
    };
  }

  private async persist(input: PersistInput): Promise<TransferQuoteDoc> {
    const [created] = await this.quotes.create(
      [{
        _id: input.quoteId,
        customerId: input.customerId,
        fromAccountId: input.request.fromAccountId,
        destination: input.destination,
        destinationKey: destinationFingerprint(input.destination),
        rail: input.rail,
        debit: embedAmount(input.priced.debit),
        credit: embedAmount(input.priced.credit),
        feeMinorUnits: totalFees(input.fees, input.priced.debit.currency).minorUnits,
        feeBreakdown: input.fees.map((fee) => ({
          code: fee.code, label: fee.label, minorUnits: fee.amount.minorUnits,
        })),
        fxRate: input.priced.fx?.rate ?? null,
        fxSpreadBps: input.priced.fx?.spreadBps ?? null,
        fxRoundingDelta: input.priced.fx?.roundingDelta ?? 0,
        estimatedArrival: input.estimate.settlesAt,
        cutOffAt: input.estimate.cutOffAt,
        status: TRANSFER_QUOTE_STATUSES.ISSUED,
        signature: signTransferQuote(this.key(), this.terms(input)),
        issuedAt: input.now,
        expiresAt: input.expiresAt,
        redeemedAt: null,
        redeemedTransferId: null,
      }],
      { ordered: true },
    );
    if (!created) {
      throw new ValidationError('The quote could not be issued');
    }
    return created;
  }

  private terms(input: PersistInput): SignedTransferQuoteTerms {
    return {
      quoteId: input.quoteId,
      customerId: input.customerId,
      fromAccountId: input.request.fromAccountId,
      rail: input.rail,
      destinationKey: destinationFingerprint(input.destination),
      debitMinorUnits: input.priced.debit.minorUnits,
      debitCurrency: input.priced.debit.currency,
      creditMinorUnits: input.priced.credit.minorUnits,
      creditCurrency: input.priced.credit.currency,
      feeMinorUnits: totalFees(input.fees, input.priced.debit.currency).minorUnits,
      fxRate: input.priced.fx?.rate ?? null,
      expiresAtMs: input.expiresAt.getTime(),
    };
  }

  /** Spend-time behaviour — redemption, binding, step-up — lives in TransferQuoteRedemptionService. */
  private key(): string {
    return this.config.crypto.fieldEncryptionKey;
  }
}

function embedAmount(amount: Money): { minorUnits: number; currency: string } {
  return { minorUnits: amount.minorUnits, currency: amount.currency };
}
