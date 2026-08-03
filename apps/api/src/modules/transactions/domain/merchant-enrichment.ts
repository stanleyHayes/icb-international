import type { Merchant, TransactionCategory } from '@icb/contracts';

import { categoriseTransaction } from './categoriser.js';
import {
  MERCHANT_DIRECTORY,
  categoryForMcc,
  type MerchantDirectoryEntry,
} from './merchant-directory.constants.js';

/**
 * Merchant enrichment.
 *
 * Pure and deterministic: the same narrative always enriches to the same merchant, and no
 * lookup ever leaves the process (agent_plan.md N2). A directory hit wins; failing that, card
 * activity still gets a merchant — cleaned from the narrative — because a card debit always
 * has one, while a bank transfer's counterparty is not a merchant and stays null.
 */

/** Transaction types that always happen at a merchant. */
const MERCHANT_TYPES: ReadonlySet<string> = new Set(['card_purchase', 'card_refund']);

/**
 * Acquirer and gateway decorations that precede the real merchant name in a narrative.
 * Longest first; a trailing space where the word alone could prefix a real name (`POS` in
 * `POST OFFICE`). Matched with `startsWith` — no regex, no backtracking, no ambiguity.
 */
const ACQUIRER_PREFIXES = [
  'CARD PURCHASE ',
  'PAYPAL *',
  'PAYPAL*',
  'TST *',
  'TST*',
  'SQ *',
  'SQ*',
  'ECOMM ',
  'POS ',
  'SP ',
] as const;

/** Separator characters that may precede a trailing store/terminal number. */
const NOISE_CHARS: ReadonlySet<string> = new Set([' ', '#', '*', '-', '–', '—', ':']);

/** Strips a trailing store/terminal number and its separators (`SHOPRITE #0042`, `SHELL -- 12`). */
function stripTrailingNoise(value: string): string {
  let end = value.length;
  while (end > 0 && value.charCodeAt(end - 1) >= 48 && value.charCodeAt(end - 1) <= 57) {
    end -= 1;
  }
  if (end === value.length) {
    return value;
  }
  while (end > 0 && NOISE_CHARS.has(value.charAt(end - 1))) {
    end -= 1;
  }
  return value.slice(0, end);
}

/** Hints the seed appends after a spaced dash (`Meridian Properties — rent`) are context. */
const HINT_DASHES = [' — ', ' – ', ' - '] as const;

const MAX_MERCHANT_NAME = 60;

/** The narrative minus any trailing " — hint" the seed attached. */
function stripHint(value: string): string {
  for (const dash of HINT_DASHES) {
    const at = value.indexOf(dash);
    if (at > 0) {
      return value.slice(0, at);
    }
  }
  return value;
}

/** The narrative minus any acquirer decoration at its head. */
function stripAcquirerPrefix(value: string): string {
  for (const prefix of ACQUIRER_PREFIXES) {
    if (value.startsWith(prefix)) {
      return value.slice(prefix.length).trimStart();
    }
  }
  return value;
}

/** The canonical key a narrative is matched and displayed under. */
export function normaliseNarrative(description: string): string {
  return stripTrailingNoise(stripAcquirerPrefix(stripHint(description.toUpperCase())))
    .replace(/\s+/g, ' ')
    .trim();
}

/** Title-case for the fallback merchant built from a cleaned narrative. */
function toDisplayName(normalised: string): string {
  const words = normalised.toLowerCase().split(' ');
  const name = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  return name.slice(0, MAX_MERCHANT_NAME);
}

function toMerchant(entry: MerchantDirectoryEntry): Merchant {
  return {
    name: entry.name,
    category: categoryForMcc(entry.mcc) ?? 'other',
    mcc: entry.mcc,
    city: entry.city,
    country: entry.country,
    logoUrl: null,
  };
}

/**
 * Resolves the merchant behind a transaction narrative, or null when the transaction did
 * not involve one (salary, internal transfer, fee). `fallbackCategory` is the category the
 * caller already computed, reused so an unlisted merchant still files sensibly.
 */
export function enrichMerchant(
  description: string,
  transactionType: string,
  fallbackCategory: TransactionCategory,
): Merchant | null {
  const key = normaliseNarrative(description);
  if (key.length === 0) {
    return null;
  }

  const known = MERCHANT_DIRECTORY.find((entry) => entry.pattern.test(key));
  if (known) {
    return toMerchant(known);
  }

  if (!MERCHANT_TYPES.has(transactionType)) {
    return null;
  }

  return {
    name: toDisplayName(key),
    category: fallbackCategory,
    mcc: null,
    city: null,
    country: null,
    logoUrl: null,
  };
}

/** Convenience wrapper when only the description and type are at hand. */
export function enrichFromNarrative(description: string, transactionType: string): Merchant | null {
  return enrichMerchant(
    description,
    transactionType,
    categoriseTransaction(transactionType, description, 'debit'),
  );
}
