import type { TransferDestination } from '@icb/contracts';
import type { Money } from '@icb/money';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError, ValidationError } from '../../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { destinationFingerprint, verifyTransferQuote } from '../domain/quote-signature.js';
import {
  TransferQuoteAlreadyUsedError,
  TransferQuoteExpiredError,
  TransferQuoteSignatureInvalidError,
} from '../domain/transfer-errors.js';
import { STEP_UP_THRESHOLD_MAJOR_UNITS } from '../domain/transfers.constants.js';
import {
  quoteRequiresStepUp,
  thresholdMinorUnits,
  toRedeemedQuote,
  toSignedQuoteTerms,
  type RedeemedTransferQuote,
} from '../infrastructure/transfer-quote.mapper.js';
import {
  TRANSFER_QUOTE_STATUSES,
  TransferQuoteDoc,
} from '../infrastructure/transfer-quote.schemas.js';
import { TransferStepUpService, type StepUpProof } from './transfer-step-up.service.js';

/** What a redemption binds the quote to — the account and payee it was issued for. */
export interface QuoteBinding {
  readonly fromAccountId: string;
  readonly destination: TransferDestination;
}

/**
 * Spending transfer quotes.
 *
 * Redemption is single-use — a conditional update, so two confirms race and one loses — which
 * is why the step-up check runs *before* the spend: a customer who has no second-factor proof
 * yet must find out with their quote intact, then retry holding the token. The same threshold
 * also guards quote-less inline terms, because skipping the quote must not skip the check.
 */
@Injectable()
export class TransferQuoteRedemptionService {
  constructor(
    @InjectModel(TransferQuoteDoc.name) private readonly quotes: Model<TransferQuoteDoc>,
    private readonly stepUp: TransferStepUpService,
    private readonly clock: ClockService,
    @Inject(CONFIG) private readonly config: AppConfiguration,
  ) {}

  /** Confirm and spend a quote that flagged step-up only once the proof has verified. */
  async confirm(
    customerId: string,
    quoteId: string,
    binding: QuoteBinding,
    proof?: StepUpProof,
  ): Promise<RedeemedTransferQuote> {
    const doc = await this.loadRedeemable(customerId, quoteId, binding);
    if (quoteRequiresStepUp(doc)) {
      await this.stepUp.assert(proof);
    }
    return this.spend(doc);
  }

  /** The high-value check for inline terms — the same threshold a flagged quote applies. */
  async assertHighValueStepUp(
    debit: Money,
    fees: Money,
    proof: StepUpProof | undefined,
  ): Promise<void> {
    const threshold = thresholdMinorUnits(STEP_UP_THRESHOLD_MAJOR_UNITS, debit.currency);
    if (debit.minorUnits + fees.minorUnits < threshold) {
      return;
    }
    await this.stepUp.assert(proof);
  }

  /** Spend the quote — the conditional update makes it single-use under a double confirm. */
  private async spend(doc: TransferQuoteDoc): Promise<RedeemedTransferQuote> {
    const redeemed = await this.quotes
      .findOneAndUpdate(
        {
          _id: doc._id,
          customerId: doc.customerId,
          status: TRANSFER_QUOTE_STATUSES.ISSUED,
          expiresAt: { $gt: this.clock.now() },
        },
        { $set: { status: TRANSFER_QUOTE_STATUSES.REDEEMED, redeemedAt: this.clock.now() } },
        { new: true },
      )
      .lean();

    if (!redeemed) {
      throw new TransferQuoteAlreadyUsedError(doc._id);
    }
    return toRedeemedQuote(doc);
  }

  /** The live, untampered, correctly-bound quote document — or the reason it cannot be used. */
  private async loadRedeemable(
    customerId: string,
    quoteId: string,
    binding: QuoteBinding,
  ): Promise<TransferQuoteDoc> {
    const doc = await this.quotes.findOne({ _id: quoteId, customerId }).lean();
    if (!doc) {
      throw new NotFoundError('Transfer quote', quoteId);
    }
    await this.assertLive(doc);
    this.assertSignature(doc);
    this.assertBinding(doc, binding);
    return doc;
  }

  /** Expiry is recorded when it is noticed, so the collection reflects what actually happened. */
  private async assertLive(doc: TransferQuoteDoc): Promise<void> {
    if (doc.status === TRANSFER_QUOTE_STATUSES.REDEEMED) {
      throw new TransferQuoteAlreadyUsedError(doc._id);
    }
    if (doc.expiresAt.getTime() <= this.clock.epochMs()) {
      await this.quotes.updateOne(
        { _id: doc._id, status: TRANSFER_QUOTE_STATUSES.ISSUED },
        { $set: { status: TRANSFER_QUOTE_STATUSES.EXPIRED } },
      );
      throw new TransferQuoteExpiredError(doc._id, doc.expiresAt);
    }
  }

  private assertSignature(doc: TransferQuoteDoc): void {
    if (!verifyTransferQuote(this.key(), toSignedQuoteTerms(doc), doc.signature)) {
      throw new TransferQuoteSignatureInvalidError(doc._id);
    }
  }

  /** A quote pays only the destination it was issued for. */
  private assertBinding(doc: TransferQuoteDoc, binding: QuoteBinding): void {
    const destinationMatches = doc.destinationKey === destinationFingerprint(binding.destination);
    if (doc.fromAccountId !== binding.fromAccountId || !destinationMatches) {
      throw new ValidationError('This quote does not match the transfer being made', [
        { path: 'quoteId', message: 'The quote was issued for a different account or payee' },
      ]);
    }
  }

  private key(): string {
    return this.config.crypto.fieldEncryptionKey;
  }
}
