import type { BillPayment, BillerCategory, LinkedBill } from '@icb/contracts';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import type { BillPaymentDoc } from './bill-payment.schemas.js';
import type { BillerDoc } from './biller.schemas.js';
import type { LinkedBillDoc } from './bill.schemas.js';

type Autopay = NonNullable<LinkedBill['autopay']>;

/**
 * The flat autopay columns become the nested contract object again.
 *
 * A bill with no account attached has never had autopay configured, which is a different state
 * from "configured and switched off" — the customer's chosen account and cap survive a pause.
 */
function toAutopay(bill: LinkedBillDoc): Autopay | null {
  if (!bill.autopayFromAccountId) {
    return null;
  }

  return {
    enabled: bill.autopayEnabled,
    fromAccountId: bill.autopayFromAccountId,
    strategy: bill.autopayStrategy as Autopay['strategy'],
    fixedAmount:
      bill.autopayFixedMinorUnits === null
        ? null
        : toMoneyDto(bill.autopayFixedMinorUnits, bill.currency),
    daysBeforeDue: bill.autopayDaysBeforeDue,
    capAmount:
      bill.autopayCapMinorUnits === null
        ? null
        : toMoneyDto(bill.autopayCapMinorUnits, bill.currency),
  };
}

export function toLinkedBill(bill: LinkedBillDoc, biller: BillerDoc): LinkedBill {
  return {
    id: bill._id,
    billerId: biller._id,
    billerName: biller.name,
    billerLogoUrl: biller.logoUrl,
    category: biller.category as BillerCategory,
    nickname: bill.nickname,
    customerReference: bill.customerReference,
    outstandingBalance:
      bill.outstandingMinorUnits === null
        ? null
        : toMoneyDto(bill.outstandingMinorUnits, bill.currency),
    dueOn: bill.dueOn,
    autopay: toAutopay(bill),
    lastPaidAt: bill.lastPaidAt?.toISOString() ?? null,
    lastPaidAmount:
      bill.lastPaidMinorUnits === null
        ? null
        : toMoneyDto(bill.lastPaidMinorUnits, bill.currency),
    createdAt: bill.createdAt.toISOString(),
  };
}

export function toBillPayment(payment: BillPaymentDoc): BillPayment {
  return {
    id: payment._id,
    billId: payment.billId,
    billerName: payment.billerName,
    customerReference: payment.customerReference,
    amount: toMoneyDto(payment.amountMinorUnits, payment.currency),
    fee: toMoneyDto(payment.feeMinorUnits, payment.currency),
    status: payment.status as BillPayment['status'],
    billerReference: payment.billerReference,
    failureReason: payment.failureReason,
    transactionId: payment.transactionId,
    scheduledFor: payment.scheduledFor?.toISOString() ?? null,
    paidAt: payment.paidAt?.toISOString() ?? null,
    createdAt: payment.createdAt.toISOString(),
  };
}
