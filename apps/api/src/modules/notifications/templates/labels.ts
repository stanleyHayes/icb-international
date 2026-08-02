/**
 * Shared wording.
 *
 * One place for every label a customer reads means a bank that says "Available balance" in one
 * email and "Balance" in the next is impossible, and a copy review is one file rather than
 * sixteen. It also keeps each template file clear of repeated string literals.
 */

export const LABEL = {
  amount: 'Amount',
  reference: 'Reference',
  account: 'Account',
  from: 'From',
  to: 'To',
  balance: 'Available balance',
  merchant: 'Merchant',
  dueDate: 'Due date',
  period: 'Period',
  status: 'Status',
  reason: 'Reason',
  device: 'Device',
  location: 'Location',
  when: 'When',
  card: 'Card',
} as const;

export const CTA = {
  viewTransfer: 'View transfer',
  viewActivity: 'View activity',
  viewCard: 'View card',
  viewAccount: 'View account',
  viewStatement: 'Download statement',
  viewLoan: 'View loan',
  payBill: 'Review the bill',
  reviewSecurity: 'Review security activity',
  viewVerification: 'Continue verification',
  viewDispute: 'View dispute',
  viewUpdate: 'See what is new',
} as const;

/** Prose stand-ins for facts a caller did not supply. Never the word "undefined". */
export const FALLBACK = {
  counterparty: 'your beneficiary',
  sender: 'a sender',
  account: 'your account',
  merchant: 'a merchant',
  amount: 'a payment',
  device: 'a new device',
  reason: 'No reason was given by the network.',
} as const;

export const SECURITY_OUTRO =
  'If this was not you, freeze your access from the ICB app and contact us straight away.';
