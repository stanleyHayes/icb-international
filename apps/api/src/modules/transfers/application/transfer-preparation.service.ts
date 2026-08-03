import type { CreateTransferRequest } from '@icb/contracts';
import { add, fromMinorUnits, isGreaterThan, type CurrencyCode, type Money } from '@icb/money';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { InsufficientFundsError } from '../../../common/errors/index.js';
import { newId, newReference } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { AccountsService } from '../../accounts/accounts.service.js';
import { resolveRail } from '../domain/rail-resolver.js';
import { feesFor, totalFees } from '../domain/transfer-fees.js';
import { assertDailyLimit, assertPerTransactionLimit } from '../domain/transfer-limits.js';
import { TransferBlockedError } from '../domain/transfer-errors.js';
import { spentOnRailToday } from '../infrastructure/transfer-query.js';
import { TransferDoc } from '../infrastructure/transfer.schemas.js';
import { DestinationResolver, type ResolvedDestination } from './destination-resolver.js';
import { FRAUD_CHECK_PORT, type FraudCheckPort } from './fraud-check.port.js';
import { TransferQuotesService, type RedeemedTransferQuote } from './transfer-quotes.service.js';
import type { PreparedTransfer } from './transfer-pipeline.types.js';

type ResolvedTerms = Omit<RedeemedTransferQuote, 'quoteId'> & {
  quoteId: string | null;
  totalFees: Money;
};

/**
 * Steps 1–9 of the pipeline: everything before a rail is involved.
 *
 * Validate, limits, beneficiary check, fraud score, FX terms, fee calc, funds — in this order,
 * every time, for every rail. The orchestrator consumes the resulting `PreparedTransfer`;
 * a rail use-case never sees an unchecked payment.
 */
@Injectable()
export class TransferPreparationService {
  constructor(
    @InjectModel(TransferDoc.name) private readonly transfers: Model<TransferDoc>,
    private readonly accounts: AccountsService,
    private readonly destinations: DestinationResolver,
    private readonly quotes: TransferQuotesService,
    @Inject(FRAUD_CHECK_PORT) private readonly fraud: FraudCheckPort,
    private readonly clock: ClockService,
  ) {}

  async prepare(
    customerId: string,
    request: CreateTransferRequest,
  ): Promise<PreparedTransfer> {
    const resolved = await this.destinations.resolve(request.destination, customerId);
    const source = await this.accounts.loadSpendable(request.fromAccountId, customerId);
    const terms = await this.resolveTerms(customerId, request, resolved.destination);

    assertPerTransactionLimit(terms.rail, terms.debit);
    const spent = await spentOnRailToday(this.transfers, customerId, terms.rail, this.clock);
    assertDailyLimit(terms.rail, terms.debit, spent);
    await this.destinations.assertPayable(resolved, terms.debit, customerId);

    const transferId = newId();
    await this.score(customerId, transferId, terms.debit, resolved);
    const display = await this.destinations.describe(resolved, customerId);

    return {
      customerId,
      transferId,
      reference: newReference('TRF'),
      destination: resolved.destination,
      rail: terms.rail,
      source,
      debit: terms.debit,
      credit: terms.credit,
      fx: terms.fx,
      fees: terms.fees,
      totalFees: terms.totalFees,
      recipientName: display.name,
      recipientMasked: display.masked,
      customerReference: request.reference ?? null,
      note: request.note ?? null,
      quoteId: terms.quoteId,
      now: this.clock.now(),
    };
  }

  /** Quote redemption, or the inline same-currency terms. */
  private async resolveTerms(
    customerId: string,
    request: CreateTransferRequest,
    destination: CreateTransferRequest['destination'],
  ): Promise<ResolvedTerms> {
    if (request.quoteId) {
      const quote = await this.quotes.redeem(customerId, request.quoteId, {
        fromAccountId: request.fromAccountId,
        destination,
      });
      return { ...quote, totalFees: totalFees(quote.fees, quote.debit.currency) };
    }

    const debit = fromMinorUnits(request.amount.minorUnits, request.amount.currency);
    const rail = resolveRail(destination);
    const fees = feesFor(rail, debit.currency);
    return {
      quoteId: null,
      rail,
      debit,
      credit: debit,
      fx: null,
      fees,
      totalFees: totalFees(fees, debit.currency),
      estimatedArrival: this.clock.now(),
    };
  }

  /** Step 4: the fraud score. Only an outright block stops the payment here. */
  private async score(
    customerId: string,
    transferId: string,
    debit: Money,
    resolved: ResolvedDestination,
  ): Promise<void> {
    const outcome = await this.fraud.check({
      customerId,
      subjectId: transferId,
      amountMinorUnits: debit.minorUnits,
      currency: debit.currency,
      beneficiaryId: resolved.beneficiaryId,
      countryCode:
        resolved.destination.kind === 'international' ? resolved.destination.country : null,
    });
    if (outcome.decision === 'block') {
      throw new TransferBlockedError(transferId, outcome.assessmentId ?? 'unrecorded');
    }
  }

  /** The debit must fit inside the available balance, fees included. */
  async assertFunds(prepared: PreparedTransfer): Promise<void> {
    const total = add(prepared.debit, prepared.totalFees);
    const balances = await this.accounts.balancesFor(prepared.source._id, total.currency);
    if (isGreaterThan(total, balances.available)) {
      throw new InsufficientFundsError(prepared.source._id, total, balances.available);
    }
  }

  /** Payee bookkeeping, delegated to the resolver that owns beneficiary concerns. */
  async savePayee(
    customerId: string,
    destination: PreparedTransfer['destination'],
    name: string,
    nickname?: string,
  ): Promise<void> {
    await this.destinations.savePayee(customerId, destination, name, nickname);
  }

  /** Rebuild the pipeline input from a stored scheduled transfer, for the due executor. */
  async preparedFromDocument(doc: TransferDoc): Promise<PreparedTransfer> {
    const source = await this.accounts.loadSpendable(doc.fromAccountId, doc.customerId);
    const currency = doc.currency as CurrencyCode;
    const fees = doc.feeBreakdown.map((fee) => ({
      code: fee.code,
      label: fee.label,
      amount: fromMinorUnits(fee.minorUnits, currency),
    }));
    return {
      customerId: doc.customerId,
      transferId: doc._id,
      reference: doc.reference,
      destination: doc.destination as PreparedTransfer['destination'],
      rail: doc.rail as PreparedTransfer['rail'],
      source,
      debit: fromMinorUnits(doc.debitMinorUnits, currency),
      credit: fromMinorUnits(doc.creditMinorUnits, (doc.creditCurrency ?? doc.currency) as CurrencyCode),
      fx: doc.fx ? { rate: doc.fx.rate, spreadBps: doc.fx.spreadBps, roundingDelta: 0 } : null,
      fees,
      totalFees: totalFees(fees, currency),
      recipientName: doc.recipientName,
      recipientMasked: doc.recipientMasked,
      customerReference: doc.customerReference,
      note: doc.note,
      quoteId: null,
      now: this.clock.now(),
    };
  }
}
