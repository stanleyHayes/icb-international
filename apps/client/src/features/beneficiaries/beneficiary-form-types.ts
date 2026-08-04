import type { TransferDestination } from '@icb/contracts';

export type PayeeKind = 'icb_customer' | 'domestic_bank' | 'international';

export interface FormFields {
  nickname: string;
  name: string;
  kind: PayeeKind;
  favourite: boolean;
  accountNumber: string;
  sortCode: string;
  iban: string;
  bic: string;
  country: string;
  bankName: string;
}

export type PatchFields = (changes: Partial<FormFields>) => void;

export const INITIAL_FIELDS: FormFields = {
  nickname: '',
  name: '',
  kind: 'domestic_bank',
  favourite: false,
  accountNumber: '',
  sortCode: '',
  iban: '',
  bic: '',
  country: '',
  bankName: '',
};

/** Build the contract destination from flat form fields; `null` while incomplete. */
export function buildPayeeDestination(fields: FormFields): TransferDestination | null {
  if (fields.kind === 'icb_customer') {
    return /^\d{10}$/.test(fields.accountNumber)
      ? { kind: 'icb_customer', accountNumber: fields.accountNumber }
      : null;
  }
  if (fields.kind === 'domestic_bank') {
    const valid = /^\d{2}-\d{2}-\d{2}$/.test(fields.sortCode) && fields.accountNumber.length >= 6;
    return valid
      ? {
          kind: 'domestic_bank',
          accountHolderName: fields.name.trim(),
          sortCode: fields.sortCode,
          accountNumber: fields.accountNumber.trim(),
        }
      : null;
  }
  const valid =
    fields.iban.trim().length >= 15 &&
    fields.bic.trim().length >= 8 &&
    fields.country.trim().length === 2;
  return valid
    ? {
        kind: 'international',
        iban: fields.iban.trim().toUpperCase(),
        bic: fields.bic.trim().toUpperCase(),
        accountHolderName: fields.name.trim(),
        country: fields.country.trim().toUpperCase(),
        ...(fields.bankName.trim() ? { bankName: fields.bankName.trim() } : {}),
      }
    : null;
}
