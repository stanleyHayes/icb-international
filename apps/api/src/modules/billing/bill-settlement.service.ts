import { add, fromMinorUnits, isGreaterThan, type Money } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { DomainError } from '../../common/errors/domain.error.js';
import { ConflictError, InsufficientFundsError } from '../../common/errors/index.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { TransactionManager } from '../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import { LedgerService } from '../ledger/ledger.service.js';
import { BillsService } from './bills.service.js';
import {
  PAYMENT_STATUS,
  actorFor,
  billCurrency,
  buildPostingCommand,
  feeFor,
  paymentInsertDefaults,
  type PayBillCommand,
} from './domain/pay-bill.command.js';
import { decideOutcome } from './domain/simulated-biller.js';
import { BillPaymentDoc } from './infrastructure/bill-payment.schemas.js';

interface PostInput {
  readonly command: PayBillCommand;
  readonly amount: Money;
  readonly fee: Money;
  readonly paymentId: string;
  readonly session: ClientSession;
}

/** The fields a posting stamps onto its payment record, whether that record is new or reused. */
interface AppliedFields {
  readonly status: string;
  readonly transactionId: string;
  readonly fromAccountId: string;
  readonly amountMinorUnits: number;
  readonly feeMinorUnits: number;
}

/**
 * The money mechanics of a bill payment.
 *
 * The order is deliberate and mirrors what actually happens on a real bill rail: ICB debits the
 * customer first, *then* asks the biller. When the biller says no, the debit has already happened,
 * so the correction is a reversal — a second, visible posting — and never an edit to the first.
 * That is why the biller decision sits outside the database transaction: a reversal that was
 * rolled back together with its original would leave no trace that anything was attempted.
 */
@Injectable()
export class BillSettlementService {
  private readonly logger = new Logger(BillSettlementService.name);

  constructor(
    @InjectModel(BillPaymentDoc.name) private readonly payments: Model<BillPaymentDoc>,
    private readonly bills: BillsService,
    private readonly accounts: AccountsService,
    private readonly ledger: LedgerService,
    private readonly transactionManager: TransactionManager,
    private readonly clock: ClockService,
  ) {}

  async execute(command: PayBillCommand): Promise<BillPaymentDoc> {
    const debited = await this.debitCustomer(command);
    return this.settleWithBiller(debited, command);
  }

  private async debitCustomer(command: PayBillCommand): Promise<BillPaymentDoc> {
    const currency = billCurrency(command.biller);
    // Ownership, frozen and closed are all answered here rather than trusted from the request.
    const account = await this.accounts.loadSpendable(command.fromAccountId, command.customerId);
    if (account.currency !== command.biller.currency) {
      throw new DomainError('ACCOUNT_CURRENCY_MISMATCH', 'The funding account is in another currency', {
        context: { accountCurrency: account.currency, billerCurrency: command.biller.currency },
      });
    }

    const amount = fromMinorUnits(command.amountMinorUnits, currency);
    const fee = feeFor(command.biller);
    const total = add(amount, fee);

    // The fee is part of what has to be affordable — a payment that clears but whose fee does not
    // is an overdrawn account created by the bank's own charge.
    const balances = await this.accounts.balancesFor(account._id, currency);
    if (isGreaterThan(total, balances.available)) {
      throw new InsufficientFundsError(account._id, total, balances.available);
    }

    const paymentId = command.paymentId ?? newId();
    return this.transactionManager.withTransaction((session) =>
      this.postAndRecord({ command, amount, fee, paymentId, session }),
    );
  }

  /** One balanced posting plus the payment record, committed together or not at all. */
  private async postAndRecord(input: PostInput): Promise<BillPaymentDoc> {
    const { command, amount, fee, paymentId, session } = input;

    const transaction = await this.ledger.postWithin(
      buildPostingCommand({ command, amount, fee, paymentId }),
      session,
    );

    const applied: AppliedFields = {
      status: PAYMENT_STATUS.processing,
      transactionId: transaction.id,
      fromAccountId: command.fromAccountId,
      amountMinorUnits: amount.minorUnits,
      feeMinorUnits: fee.minorUnits,
    };

    // A payment that was scheduled already has a record and keeps it, along with the identifier
    // the customer was given and the moment they actually asked for it.
    return command.paymentId
      ? this.reuseRecord(paymentId, applied, session)
      : this.insertRecord(command, paymentId, applied, session);
  }

  private async reuseRecord(
    paymentId: string,
    applied: AppliedFields,
    session: ClientSession,
  ): Promise<BillPaymentDoc> {
    await this.payments.updateOne({ _id: paymentId }, { $set: applied }, { session });

    const stored = await this.payments.findById(paymentId).session(session).lean();
    if (!stored) {
      throw new ConflictError('The scheduled bill payment has gone', { paymentId });
    }
    return stored;
  }

  /**
   * Written with `create` rather than an upsert on purpose: Mongoose's `timestamps` option
   * overwrites a `$setOnInsert.createdAt` with *wall-clock* time, which would silently detach this
   * record from the simulation clock. `create` honours the value we supply.
   */
  private async insertRecord(
    command: PayBillCommand,
    paymentId: string,
    applied: AppliedFields,
    session: ClientSession,
  ): Promise<BillPaymentDoc> {
    const now = this.clock.now();
    const [created] = await this.payments.create(
      [
        {
          ...paymentInsertDefaults(command, {
            now,
            valueDate: this.clock.toIsoDate(now),
            scheduledFor: null,
          }),
          _id: paymentId,
          ...applied,
        },
      ],
      { session, ordered: true },
    );

    if (!created) {
      throw new ConflictError('The bill payment record could not be written', { paymentId });
    }
    return created;
  }

  /** Ask the biller, then make the ledger agree with the answer. */
  private async settleWithBiller(
    payment: BillPaymentDoc,
    command: PayBillCommand,
  ): Promise<BillPaymentDoc> {
    const outcome = decideOutcome(command.biller, payment._id);

    if (outcome.failed) {
      return this.failPayment(payment, command, outcome.failureReason ?? 'The biller rejected the payment');
    }
    return this.completePayment(payment, command, outcome.billerReference ?? payment._id);
  }

  private async completePayment(
    payment: BillPaymentDoc,
    command: PayBillCommand,
    billerReference: string,
  ): Promise<BillPaymentDoc> {
    const paidAt = this.clock.now();

    if (payment.transactionId) {
      // The biller has the money: pending settlement has done its job.
      await this.ledger.markSettled(payment.transactionId);
    }

    const update = { status: PAYMENT_STATUS.completed, billerReference, paidAt, failureReason: null };
    await this.payments.updateOne({ _id: payment._id }, { $set: update });
    await this.bills.recordPayment(command.bill, payment.amountMinorUnits, paidAt);

    this.logger.log({ paymentId: payment._id, billerReference }, 'Bill payment completed');
    return { ...payment, ...update };
  }

  /**
   * The biller refused money ICB has already taken. Reverse the whole posting — payment leg and
   * fee leg together — so the customer is made whole in one visible pair of transactions.
   */
  private async failPayment(
    payment: BillPaymentDoc,
    command: PayBillCommand,
    reason: string,
  ): Promise<BillPaymentDoc> {
    const reversal = payment.transactionId
      ? await this.ledger.reverse(payment.transactionId, reason, actorFor(command))
      : null;

    const update = {
      status: PAYMENT_STATUS.failed,
      failureReason: reason,
      reversalTransactionId: reversal?.id ?? null,
      billerReference: null,
      paidAt: null,
    };
    await this.payments.updateOne({ _id: payment._id }, { $set: update });

    this.logger.warn(
      { paymentId: payment._id, reason, reversalTransactionId: reversal?.id ?? null },
      'Bill payment rejected by the biller; ledger reversed',
    );
    return { ...payment, ...update };
  }
}
