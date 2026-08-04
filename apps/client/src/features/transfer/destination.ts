import type { TransferDestination } from '@icb/contracts';
import { getScale, type CurrencyCode } from '@icb/money';

import type { DestinationDraft } from './wizard/draft-types';

export interface WireMoney {
  minorUnits: number;
  currency: string;
  scale: number;
}

/** Integer minor units on the wire, with the scale the currency definition says it has (N3). */
export function toWireMoney(minorUnits: number, currency: string): WireMoney {
  const code = currency as CurrencyCode;
  return { minorUnits, currency: code, scale: getScale(code) };
}

/**
 * Turn the wizard's flat destination draft into the contract's discriminated union.
 *
 * Returns `null` while the draft is incomplete, so the caller can keep the quote button
 * disabled instead of submitting a half-built destination the API would reject anyway.
 */
export function buildDestination(
  rail: string,
  draft: DestinationDraft,
): TransferDestination | null {
  if (draft.mode === 'beneficiary') {
    return draft.beneficiaryId ? { kind: 'beneficiary', beneficiaryId: draft.beneficiaryId } : null;
  }
  if (rail === 'internal') {
    return draft.accountId ? { kind: 'own_account', accountId: draft.accountId } : null;
  }
  if (rail === 'on_us') {
    return /^\d{10}$/.test(draft.accountNumber)
      ? { kind: 'icb_customer', accountNumber: draft.accountNumber }
      : null;
  }
  if (rail === 'swift') {
    return buildInternational(draft);
  }
  return buildDomestic(draft);
}

function buildDomestic(draft: DestinationDraft): TransferDestination | null {
  const valid =
    draft.holderName.trim().length > 0 &&
    /^\d{2}-\d{2}-\d{2}$/.test(draft.sortCode) &&
    draft.accountNumber.trim().length >= 6;
  return valid
    ? {
        kind: 'domestic_bank',
        accountNumber: draft.accountNumber.trim(),
        sortCode: draft.sortCode,
        accountHolderName: draft.holderName.trim(),
      }
    : null;
}

function buildInternational(draft: DestinationDraft): TransferDestination | null {
  const valid =
    draft.holderName.trim().length > 0 &&
    draft.iban.trim().length >= 15 &&
    draft.bic.trim().length >= 8 &&
    draft.country.trim().length === 2;
  if (!valid) {
    return null;
  }
  const bankName = draft.bankName.trim();
  return {
    kind: 'international',
    iban: draft.iban.trim().toUpperCase(),
    bic: draft.bic.trim().toUpperCase(),
    accountHolderName: draft.holderName.trim(),
    country: draft.country.trim().toUpperCase(),
    ...(bankName ? { bankName } : {}),
  };
}

/** One line describing a destination for summaries, lists and receipts. */
export function describeDestination(destination: TransferDestination): string {
  switch (destination.kind) {
    case 'own_account':
      return 'Your own account';
    case 'icb_customer':
      return `ICB account ${destination.accountNumber}`;
    case 'domestic_bank':
      return `${destination.accountHolderName} · ${destination.sortCode} ${destination.accountNumber}`;
    case 'international':
      return `${destination.accountHolderName} · ${destination.iban}`;
    case 'beneficiary':
      return 'Saved payee';
  }
}
