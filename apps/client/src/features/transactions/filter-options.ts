import {
  TRANSACTION_CATEGORIES,
  TRANSACTION_STATUSES,
  TRANSACTION_TYPES,
} from '@icb/contracts';
import type { FilterOption } from '@icb/ui';

/** Facet options for the transactions filter bar, labels title-cased from the contract enums. */
function toOptions(values: readonly string[]): FilterOption[] {
  return values.map((value) => ({ value, label: labelize(value) }));
}

function labelize(value: string): string {
  const words = value.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export const TRANSACTION_TYPE_OPTIONS = toOptions(TRANSACTION_TYPES);
export const TRANSACTION_STATUS_OPTIONS = toOptions(TRANSACTION_STATUSES);
export const TRANSACTION_CATEGORY_OPTIONS = toOptions(TRANSACTION_CATEGORIES);
