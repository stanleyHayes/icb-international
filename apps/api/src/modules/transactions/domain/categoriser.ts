import type { EntryDirection, TransactionCategory } from '@icb/contracts';

/**
 * Assigns a spending category.
 *
 * Deliberately simple and deterministic: transaction type first (a fee is always a fee), then
 * merchant keywords. Real categorisation would layer MCC codes and a user-override table on top;
 * both hang off this function rather than replacing it, so the fallback stays predictable.
 */
const KEYWORD_CATEGORIES: readonly [RegExp, TransactionCategory][] = [
  [/salary|payroll|wages/i, 'salary'],
  [/rent|landlord|lease/i, 'rent'],
  [/grocer|supermarket|market|food ?mart|shoprite|spar/i, 'groceries'],
  [/restaurant|cafe|coffee|pizza|burger|kitchen|bar\b|dining/i, 'dining'],
  [/uber|bolt|taxi|metro|transit|bus |train|railway/i, 'transport'],
  [/fuel|petrol|shell|total|gas station/i, 'fuel'],
  [/airline|flight|hotel|booking|airbnb|travel/i, 'travel'],
  [/amazon|shop|store|retail|mall|boutique/i, 'shopping'],
  [/netflix|spotify|cinema|game|entertain/i, 'entertainment'],
  [/electric|water|power|utility|gas bill/i, 'utilities'],
  [/insurance|assurance|cover/i, 'insurance'],
  [/hospital|clinic|pharmacy|medical|health/i, 'healthcare'],
  [/school|tuition|university|college|course/i, 'education'],
  [/subscription|monthly plan|membership/i, 'subscriptions'],
  [/atm|cash withdrawal/i, 'cash'],
];

const TYPE_CATEGORIES: Readonly<Record<string, TransactionCategory>> = {
  fee: 'fees',
  interest: 'interest',
  loan_disbursement: 'loan',
  loan_repayment: 'loan',
  atm_withdrawal: 'cash',
  fx_conversion: 'transfer',
  transfer_in: 'transfer',
  transfer_out: 'transfer',
};

export function categoriseTransaction(
  transactionType: string,
  description: string,
  direction: EntryDirection,
): TransactionCategory {
  const byType = TYPE_CATEGORIES[transactionType];
  if (byType && transactionType !== 'transfer_in' && transactionType !== 'transfer_out') {
    return byType;
  }

  for (const [pattern, category] of KEYWORD_CATEGORIES) {
    if (pattern.test(description)) {
      return category;
    }
  }

  if (byType) return byType;
  return direction === 'credit' ? 'income' : 'other';
}
