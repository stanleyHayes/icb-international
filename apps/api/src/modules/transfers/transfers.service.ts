import type { CreateTransferRequest, TransferRail, TransferSummary } from '@icb/contracts';
import { fromMinorUnits, isGreaterThan, type CurrencyCode, type Money } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { DomainError } from '../../common/errors/domain.error.js';
import { InsufficientFundsError, NotFoundError } from '../../common/errors/index.js';
import { newId, newReference } from '../../infrastructure/database/identifier.js';
import { TransactionManager } from '../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { customerRef, glRef, type AccountRef } from '../ledger/domain/account-ref.js';
import { GL_PENDING_SETTLEMENT } from '../ledger/domain/chart-of-accounts.js';
import type { PostingLine } from '../ledger/domain/posting.types.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { resolveRail } from './domain/rail-resolver.js';
import { toTransferSummary } from './infrastructure/transfer.mapper.js';
import { TransferDoc } from './infrastructure/transfer.schemas.js';

/**
 * Money movement initiated by a customer.
 *
 * The pipeline is the same for every rail — validate, check funds, post, record — and only the
 * *destination leg* differs: an on-us transfer credits another ICB account immediately, while an
 * outbound rail parks the value in pending settlement (2100) until the rail's window closes.
 * Keeping that the only variation is what stops each rail growing its own subtly different
 * money-handling code.
 */
@Injectable()
export class TransfersService {
  private readonly logger = new Logger(TransfersService.name);

  constructor(
    @InjectModel(TransferDoc.name) private readonly transfers: Model<TransferDoc>,
    private readonly accounts: AccountsService,
    private readonly ledger: LedgerService,
    private readonly transactionManager: TransactionManager,
    private readonly clock: ClockService,
  ) {}

  async create(customerId: string, request: CreateTransferRequest): Promise<TransferSummary> {
    const source = await this.accounts.loadSpendable(request.fromAccountId, customerId);
    const currency = source.currency as CurrencyCode;

    if (request.amount.currency !== currency) {
      throw new DomainError(
        'ACCOUNT_CURRENCY_MISMATCH',
        'Cross-currency transfers require an FX quote',
        { context: { accountCurrency: currency, requestCurrency: request.amount.currency } },
      );
    }

    const amount = fromMinorUnits(request.amount.minorUnits, currency);
    const balances = await this.accounts.balancesFor(source._id, currency);

    if (isGreaterThan(amount, balances.available)) {
      throw new InsufficientFundsError(source._id, amount, balances.available);
    }

    const rail = resolveRail(request.destination);
    const destinationLeg = await this.resolveDestinationLeg(request, rail);

    const reference = newReference('TRF');
    const transferId = newId();
    const now = this.clock.now();

    const posted = await this.transactionManager.withTransaction((session) =>
      this.postAndRecord({ session, source, amount, request, rail, destinationLeg, reference, transferId, customerId, currency, now }),
    );

    this.logger.log({ transferId, rail, reference }, 'Transfer created');
    return this.toSummary(transferId, source.number, posted.reference);
  }

  /** The unit of work: one balanced posting plus the transfer record, committed together. */
  private async postAndRecord(input: PostAndRecordInput) {
    const { session, source, amount, request, destinationLeg, reference, transferId } = input;

    const lines = this.buildLines(source, amount, destinationLeg);

    const transaction = await this.ledger.postWithin(
      {
        type: 'transfer_out',
        description: destinationLeg.narrative,
        actor: { kind: 'customer', id: input.customerId, label: source.number },
        lines,
        reference,
        status: destinationLeg.immediate ? 'posted' : 'authorised',
        sourceType: 'transfer',
        sourceId: transferId,
        ...(request.reference ? { metadata: { customerReference: request.reference } } : {}),
      },
      session,
    );

    await this.recordTransfer(input, transaction.id);
    return transaction;
  }

  private async recordTransfer(
    input: PostAndRecordInput,
    transactionId: string,
  ): Promise<void> {
    const { source, amount, request, destinationLeg, reference, transferId, session } = input;
    await this.transfers.create(
      [
        {
          _id: transferId,
          reference,
          customerId: input.customerId,
          fromAccountId: source._id,
          destination: request.destination,
          rail: input.rail,
          status: destinationLeg.immediate ? 'completed' : 'in_settlement',
          debitMinorUnits: amount.minorUnits,
          creditMinorUnits: amount.minorUnits,
          currency: input.currency,
          feeMinorUnits: 0,
          recipientName: destinationLeg.recipientName,
          recipientMasked: destinationLeg.recipientMasked,
          customerReference: request.reference ?? null,
          note: request.note ?? null,
          transactionId,
          estimatedArrival: destinationLeg.estimatedArrival,
          createdAt: input.now,
          completedAt: destinationLeg.immediate ? input.now : null,
          failureCode: null,
          failureReason: null,
        },
      ],
      { session, ordered: true },
    );
  }

  /** Both legs of the posting: debit the sender, credit whatever the rail lands in. */
  private buildLines(
    source: { _id: string; number: string },
    amount: Money,
    leg: DestinationLeg,
  ): PostingLine[] {
    return [
      { accountRef: customerRef(source._id), direction: 'debit', amount, narrative: leg.narrative },
      {
        accountRef: leg.accountRef,
        direction: 'credit',
        amount,
        narrative: `From ${source.number}`,
      },
    ];
  }

  async listForCustomer(customerId: string, limit = 25): Promise<TransferSummary[]> {
    const rows = await this.transfers
      .find({ customerId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return rows.map((row) => toTransferSummary(row, row.fromAccountId));
  }

  /**
   * Where the credit leg lands.
   *
   * On-us transfers credit the recipient's account directly and are final immediately. Everything
   * else credits pending settlement — the money has left the customer but has not yet reached
   * anyone, which is exactly what "in flight" means on a real statement.
   */
  private async resolveDestinationLeg(
    request: CreateTransferRequest,
    rail: TransferRail,
  ): Promise<DestinationLeg> {
    const destination = request.destination;
    const internal = destination.kind === 'own_account' || destination.kind === 'icb_customer';
    return internal ? this.internalLeg(destination) : this.externalLeg(destination, rail);
  }

  /** On-us: the recipient's account is credited directly and the transfer is final at once. */
  private async internalLeg(
    destination: CreateTransferRequest['destination'],
  ): Promise<DestinationLeg> {
    const target = await this.findInternalTarget(destination);

    if (!target) {
      throw new NotFoundError('Destination account', describeDestination(destination));
    }

    return {
      accountRef: customerRef(target._id),
      recipientName: target.nickname ?? target.productName,
      recipientMasked: maskAccountNumber(target.number),
      narrative: `Transfer to ${maskAccountNumber(target.number)}`,
      immediate: true,
      estimatedArrival: this.clock.now(),
    };
  }

  private async findInternalTarget(destination: CreateTransferRequest['destination']) {
    if (destination.kind === 'own_account') {
      return this.accounts.loadSpendable(destination.accountId);
    }
    if (destination.kind === 'icb_customer') {
      return this.accounts.findByNumber(destination.accountNumber);
    }
    return null;
  }

  /**
   * Outbound: value moves to pending settlement (2100) until the rail's window closes. The money
   * has left the customer but has not yet reached anyone — which is what "in flight" means.
   */
  private externalLeg(
    destination: CreateTransferRequest['destination'],
    rail: TransferRail,
  ): DestinationLeg {
    const name =
      'accountHolderName' in destination ? destination.accountHolderName : 'External account';

    return {
      accountRef: glRef(GL_PENDING_SETTLEMENT),
      recipientName: name,
      recipientMasked: maskAccountNumber(describeDestination(destination)),
      narrative: `Transfer to ${name}`,
      immediate: false,
      estimatedArrival: this.clock.addBusinessDays(rail === 'swift' ? 2 : 1),
    };
  }

  private async toSummary(
    transferId: string,
    fromLabel: string,
    reference: string,
  ): Promise<TransferSummary> {
    const row = await this.transfers.findById(transferId).lean();
    if (!row) {
      throw new NotFoundError('Transfer', transferId);
    }
    return { ...toTransferSummary(row, fromLabel), reference };
  }
}

/** Everything the posting unit of work needs, grouped so it stays under the parameter limit. */
interface PostAndRecordInput {
  session: ClientSession;
  source: { _id: string; number: string };
  amount: Money;
  request: CreateTransferRequest;
  rail: TransferRail;
  destinationLeg: DestinationLeg;
  reference: string;
  transferId: string;
  customerId: string;
  currency: CurrencyCode;
  now: Date;
}

/** Where the credit leg lands, and what the customer is told about it. */
interface DestinationLeg {
  accountRef: AccountRef;
  recipientName: string;
  recipientMasked: string;
  narrative: string;
  immediate: boolean;
  estimatedArrival: Date;
}

/** The identifier a destination is addressed by, whichever shape it takes. */
function describeDestination(destination: CreateTransferRequest['destination']): string {
  if ('iban' in destination) return destination.iban;
  if ('accountNumber' in destination) return destination.accountNumber;
  if ('accountId' in destination) return destination.accountId;
  return '';
}

/** Never show a full destination identifier back to a customer. */
function maskAccountNumber(value: string): string {
  return value.length <= 4 ? value : `•••• ${value.slice(-4)}`;
}
