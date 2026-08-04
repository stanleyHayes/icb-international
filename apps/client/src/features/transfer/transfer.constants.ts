import type { TransferRail } from '@icb/contracts';

/**
 * Rail presentation metadata.
 *
 * The rail *values* come from `@icb/contracts`; the copy is presentation-only. `eta` is a
 * plain-language promise the quote's `estimatedArrival` later makes concrete.
 */
export interface RailInfo {
  readonly rail: TransferRail;
  readonly title: string;
  readonly eta: string;
  readonly description: string;
}

export const RAILS: readonly RailInfo[] = [
  {
    rail: 'internal',
    title: 'Between my accounts',
    eta: 'Instant',
    description: 'Move money between your own ICB accounts. No fee.',
  },
  {
    rail: 'on_us',
    title: 'To an ICB customer',
    eta: 'Instant',
    description: 'Pay any other ICB account by account number. No fee.',
  },
  {
    rail: 'ach',
    title: 'Domestic transfer',
    eta: 'Next business day',
    description: 'Lower-cost transfer to any domestic bank account by sort code and account number.',
  },
  {
    rail: 'wire',
    title: 'Domestic wire',
    eta: 'Same day',
    description: 'Same-day guaranteed settlement for urgent domestic payments.',
  },
  {
    rail: 'swift',
    title: 'International',
    eta: '1–3 business days',
    description: 'SWIFT payment in another currency with a live FX quote before you commit.',
  },
] as const;

export function railInfo(rail: string): RailInfo {
  return RAILS.find((info) => info.rail === rail) ?? RAILS[0]!;
}

/** Recurring-transfer presets, serialised as RFC 5545 RRULEs for the API. */
export const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly', rrule: 'FREQ=WEEKLY' },
  { value: 'fortnightly', label: 'Every two weeks', rrule: 'FREQ=WEEKLY;INTERVAL=2' },
  { value: 'monthly', label: 'Monthly', rrule: 'FREQ=MONTHLY' },
  { value: 'quarterly', label: 'Quarterly', rrule: 'FREQ=MONTHLY;INTERVAL=3' },
] as const;

export type FrequencyValue = (typeof FREQUENCY_OPTIONS)[number]['value'];

export function rruleFor(frequency: string): string {
  return (
    FREQUENCY_OPTIONS.find((option) => option.value === frequency)?.rrule ?? 'FREQ=MONTHLY'
  );
}

export function frequencyLabel(rrule: string): string {
  return (
    FREQUENCY_OPTIONS.find((option) => option.rrule === rrule)?.label ?? rrule.toLowerCase()
  );
}

/** Bulk CSV columns, in order. Amounts are decimal major units, parsed to minor units server-side. */
export const BULK_CSV_HEADERS = [
  'account_holder_name',
  'sort_code',
  'account_number',
  'amount',
  'reference',
] as const;

export const BULK_ROW_LIMIT = 500;
