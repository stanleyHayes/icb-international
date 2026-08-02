import type { TransactionCategory } from '@icb/contracts';

/**
 * Merchant category code → spending category.
 *
 * Category controls are only meaningful if the bank can decide, at authorisation time, what a
 * merchant actually sells. The card network supplies an MCC and nothing else, so the mapping has
 * to live here — a customer who blocks "gambling" expects the decline to happen at the terminal,
 * not in a monthly report.
 *
 * Ranges are evaluated in order and the first match wins, so a narrow range (fuel) is listed
 * before the broader range that contains it (vehicles and transport).
 */
const MCC_RANGES: readonly (readonly [number, number, TransactionCategory])[] = [
  [3000, 3299, 'travel'],
  [3300, 3499, 'travel'],
  [3500, 3999, 'travel'],
  [4111, 4131, 'transport'],
  [4411, 4457, 'travel'],
  [4468, 4468, 'travel'],
  [4511, 4582, 'travel'],
  [4722, 4723, 'travel'],
  [4784, 4789, 'transport'],
  [4812, 4816, 'subscriptions'],
  [4821, 4821, 'utilities'],
  [4899, 4900, 'utilities'],
  [5013, 5199, 'shopping'],
  [5200, 5271, 'shopping'],
  [5300, 5310, 'groceries'],
  [5311, 5399, 'shopping'],
  [5411, 5499, 'groceries'],
  [5541, 5542, 'fuel'],
  [5511, 5599, 'transport'],
  [5611, 5699, 'shopping'],
  [5712, 5799, 'shopping'],
  [5811, 5814, 'dining'],
  [5912, 5912, 'healthcare'],
  [5960, 5969, 'subscriptions'],
  [5970, 5999, 'shopping'],
  [6010, 6011, 'cash'],
  [6012, 6051, 'transfer'],
  [6211, 6211, 'savings'],
  [6300, 6399, 'insurance'],
  [7011, 7099, 'travel'],
  [7210, 7299, 'shopping'],
  [7511, 7549, 'transport'],
  [7800, 7999, 'entertainment'],
  [8000, 8099, 'healthcare'],
  [8200, 8299, 'education'],
  [8351, 8351, 'education'],
  [8931, 8999, 'fees'],
  [9211, 9399, 'fees'],
];

/**
 * The category a merchant category code belongs to. Unknown codes fall back to `other` rather
 * than guessing, so a blocked-category rule never fires on a merchant it was not meant for.
 */
export function categoryForMcc(mcc: string): TransactionCategory {
  const code = Number(mcc);
  if (!Number.isInteger(code)) {
    return 'other';
  }

  for (const [from, to, category] of MCC_RANGES) {
    if (code >= from && code <= to) {
      return category;
    }
  }
  return 'other';
}

/** ATM cash withdrawal codes — the network signals these separately from a purchase. */
export function isCashWithdrawal(mcc: string): boolean {
  return categoryForMcc(mcc) === 'cash';
}
