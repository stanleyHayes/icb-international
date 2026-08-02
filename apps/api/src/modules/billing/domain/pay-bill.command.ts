import { fromMinorUnits, type CurrencyCode, type Money } from '@icb/money';

import { customerRef, glRef } from '../../ledger/domain/account-ref.js';
import { GL_FEE_INCOME, GL_PENDING_SETTLEMENT } from '../../ledger/domain/chart-of-accounts.js';
import type { PostingActor, PostingCommand, PostingLine } from '../../ledger/domain/posting.types.js';
import type { BillerDoc } from '../infrastructure/biller.schemas.js';
import type { LinkedBillDoc } from '../infrastructure/bill.schemas.js';

/** Links the ledger transaction back to the payment that caused it. */
export const BILL_PAYMENT_SOURCE = 'bill_payment';

/** The lifecycle of a bill payment, as a value so the strings live in exactly one place. */
export const PAYMENT_STATUS = {
  scheduled: 'scheduled',
  processing: 'processing',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
} as const;

export interface PayBillCommand {
  readonly customerId: string;
  readonly bill: LinkedBillDoc;
  readonly biller: BillerDoc;
  readonly fromAccountId: string;
  readonly amountMinorUnits: number;
  readonly initiatedBy: 'customer' | 'autopay';
  /** Set when re-running a payment record that already exists, e.g. one that was scheduled. */
  readonly paymentId?: string;
}

export function billCurrency(biller: BillerDoc): CurrencyCode {
  return biller.currency as CurrencyCode;
}

export function feeFor(biller: BillerDoc): Money {
  return fromMinorUnits(biller.feeMinorUnits, billCurrency(biller));
}

/**
 * Who the ledger records as having moved the money.
 *
 * An autopay debit was not initiated by the customer at that moment — it was initiated by a rule
 * they set earlier — and the statement should not claim otherwise.
 */
export function actorFor(command: PayBillCommand): PostingActor {
  if (command.initiatedBy === 'autopay') {
    return { kind: 'system', id: null, label: 'Autopay' };
  }
  return { kind: 'customer', id: command.customerId, label: command.bill.customerReference };
}

export interface PaymentLegs {
  readonly accountId: string;
  readonly amount: Money;
  readonly fee: Money;
  readonly billerName: string;
  readonly customerReference: string;
}

/**
 * Debit the customer, credit pending settlement (2100): the money has left the customer but the
 * biller has not confirmed receipt, which is precisely what 2100 represents.
 *
 * The fee is a second *pair* of legs on the SAME transaction — debit the customer, credit fee
 * income (4000). Posting it separately would let a fee survive a reversed payment, which is the
 * kind of thing that turns into a regulatory finding rather than a bug report.
 */
export function buildPaymentLines(legs: PaymentLegs): PostingLine[] {
  const narrative = `Bill payment to ${legs.billerName} (${legs.customerReference})`;

  const lines: PostingLine[] = [
    { accountRef: customerRef(legs.accountId), direction: 'debit', amount: legs.amount, narrative },
    { accountRef: glRef(GL_PENDING_SETTLEMENT), direction: 'credit', amount: legs.amount, narrative },
  ];

  if (legs.fee.minorUnits > 0) {
    const feeNarrative = `Bill payment fee — ${legs.billerName}`;
    lines.push(
      { accountRef: customerRef(legs.accountId), direction: 'debit', amount: legs.fee, narrative: feeNarrative },
      { accountRef: glRef(GL_FEE_INCOME), direction: 'credit', amount: legs.fee, narrative: feeNarrative },
    );
  }

  return lines;
}

export interface PostingInput {
  readonly command: PayBillCommand;
  readonly amount: Money;
  readonly fee: Money;
  readonly paymentId: string;
}

/**
 * The whole posting instruction for one bill payment.
 *
 * Assembled here rather than in the service so that "what does a bill debit look like on the
 * ledger?" has a single, readable answer — and so `sourceType` / `sourceId` are never forgotten,
 * which is what lets a statement line be traced back to the payment that produced it.
 */
export function buildPostingCommand(input: PostingInput): PostingCommand {
  const { command, amount, fee, paymentId } = input;

  return {
    type: 'transfer_out',
    description: `Bill payment to ${command.biller.name}`,
    actor: actorFor(command),
    lines: buildPaymentLines({
      accountId: command.fromAccountId,
      amount,
      fee,
      billerName: command.biller.name,
      customerReference: command.bill.customerReference,
    }),
    sourceType: BILL_PAYMENT_SOURCE,
    sourceId: paymentId,
    metadata: { billerCode: command.biller.code, billId: command.bill._id },
  };
}

export interface PaymentInsertDefaults {
  readonly customerId: string;
  readonly billId: string;
  readonly billerId: string;
  readonly billerName: string;
  readonly customerReference: string;
  readonly currency: string;
  readonly initiatedBy: string;
  readonly valueDate: string;
  readonly scheduledFor: Date | null;
  readonly createdAt: Date;
  readonly billerReference: null;
  readonly failureReason: null;
  readonly reversalTransactionId: null;
  readonly paidAt: null;
}

/** Everything about a payment that is fixed when the record is first written. */
export function paymentInsertDefaults(
  command: PayBillCommand,
  context: { now: Date; valueDate: string; scheduledFor: Date | null },
): PaymentInsertDefaults {
  return {
    customerId: command.customerId,
    billId: command.bill._id,
    billerId: command.biller._id,
    billerName: command.biller.name,
    customerReference: command.bill.customerReference,
    currency: command.biller.currency,
    initiatedBy: command.initiatedBy,
    valueDate: context.valueDate,
    scheduledFor: context.scheduledFor,
    createdAt: context.now,
    billerReference: null,
    failureReason: null,
    reversalTransactionId: null,
    paidAt: null,
  };
}
