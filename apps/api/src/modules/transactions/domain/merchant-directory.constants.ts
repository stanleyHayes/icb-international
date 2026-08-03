import type { TransactionCategory } from '@icb/contracts';

/**
 * The local merchant directory.
 *
 * Enrichment is deliberately offline and deterministic (agent_plan.md N2): a narrative either
 * matches a directory pattern or it does not, and the same input always produces the same
 * merchant. Entries are matched against the *normalised* narrative — upper-cased, acquirer
 * prefixes and store numbers stripped — so patterns stay short and readable.
 */
export interface MerchantDirectoryEntry {
  readonly pattern: RegExp;
  readonly name: string;
  /** ISO 8583 merchant category code; the spending category derives from it, never duplicated. */
  readonly mcc: string;
  readonly city: string | null;
  readonly country: string | null;
}

/** MCC → spending category. The single place that knows what a code means. */
export const MCC_CATEGORIES: Readonly<Record<string, TransactionCategory>> = {
  '4111': 'transport',
  '4121': 'transport',
  '4511': 'travel',
  '4814': 'utilities',
  '4899': 'subscriptions',
  '4900': 'utilities',
  '5411': 'groceries',
  '5541': 'fuel',
  '5732': 'shopping',
  '5812': 'dining',
  '5814': 'dining',
  '5912': 'healthcare',
  '5942': 'shopping',
  '6300': 'insurance',
  '6513': 'rent',
  '7011': 'travel',
  '7832': 'entertainment',
  '7997': 'subscriptions',
};

/** Category for a known MCC, or null when the code is not in the table. */
export function categoryForMcc(mcc: string): TransactionCategory | null {
  return MCC_CATEGORIES[mcc] ?? null;
}

/**
 * Known merchants, local ones first (they carry city/country) then global brands (which do
 * not — a Netflix debit is not "in" any city). Order matters only for overlapping patterns,
 * so the more specific name always precedes the generic one.
 */
export const MERCHANT_DIRECTORY: readonly MerchantDirectoryEntry[] = [
  { pattern: /PALM GROVE/, name: 'Palm Grove Supermarket', mcc: '5411', city: 'Accra', country: 'GH' },
  { pattern: /KOFI & SONS/, name: 'Kofi & Sons Grocers', mcc: '5411', city: 'Accra', country: 'GH' },
  { pattern: /COPPER KETTLE/, name: 'The Copper Kettle', mcc: '5814', city: 'Accra', country: 'GH' },
  { pattern: /EMBER KITCHEN/, name: 'Ember Kitchen', mcc: '5812', city: 'Accra', country: 'GH' },
  { pattern: /NORTHGATE PHARMACY/, name: 'Northgate Pharmacy', mcc: '5912', city: 'Accra', country: 'GH' },
  { pattern: /ATLAS BOOKS/, name: 'Atlas Books', mcc: '5942', city: 'Accra', country: 'GH' },
  { pattern: /HARBOUR CINEMA/, name: 'Harbour Cinema', mcc: '7832', city: 'Accra', country: 'GH' },
  { pattern: /ZENITH ELECTRONICS/, name: 'Zenith Electronics', mcc: '5732', city: 'Accra', country: 'GH' },
  { pattern: /MARINA HOTEL/, name: 'Marina Hotel', mcc: '7011', city: 'Accra', country: 'GH' },
  { pattern: /SKYLINE AIRWAYS/, name: 'Skyline Airways', mcc: '4511', city: 'Accra', country: 'GH' },
  { pattern: /MERIDIAN PROPERTIES/, name: 'Meridian Properties', mcc: '6513', city: 'Accra', country: 'GH' },
  { pattern: /VOLTA POWER/, name: 'Volta Power', mcc: '4900', city: 'Accra', country: 'GH' },
  { pattern: /AQUA UTILITIES/, name: 'Aqua Utilities', mcc: '4900', city: 'Accra', country: 'GH' },
  { pattern: /FIBRELINK/, name: 'FibreLink Internet', mcc: '4899', city: 'Accra', country: 'GH' },
  { pattern: /SENTINEL INSURANCE/, name: 'Sentinel Insurance', mcc: '6300', city: 'Accra', country: 'GH' },
  { pattern: /PHONECO/, name: 'PhoneCo', mcc: '4814', city: 'Accra', country: 'GH' },
  { pattern: /FITLAB/, name: 'FitLab', mcc: '7997', city: 'Accra', country: 'GH' },
  { pattern: /METRO TRANSIT/, name: 'Metro Transit', mcc: '4111', city: null, country: null },
  { pattern: /SHELL/, name: 'Shell', mcc: '5541', city: null, country: null },
  { pattern: /BOLT/, name: 'Bolt', mcc: '4121', city: null, country: null },
  { pattern: /UBER/, name: 'Uber', mcc: '4121', city: null, country: null },
  { pattern: /NETFLIX/, name: 'Netflix', mcc: '4899', city: null, country: null },
  { pattern: /SPOTIFY/, name: 'Spotify', mcc: '4899', city: null, country: null },
  { pattern: /AMAZON/, name: 'Amazon', mcc: '5732', city: null, country: null },
];
