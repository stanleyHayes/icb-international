import type { TransferRail } from '@icb/contracts';

import type { FrequencyValue } from '../transfer.constants';

/** The wizard's working state for where money is going. */
export interface DestinationDraft {
  /** `beneficiary` reuses a saved payee; `new` collects inline account details. */
  mode: 'beneficiary' | 'new';
  beneficiaryId: string;
  /** own_account (internal rail). */
  accountId: string;
  /** icb_customer / domestic_bank. */
  accountNumber: string;
  sortCode: string;
  /** international. */
  iban: string;
  bic: string;
  country: string;
  bankName: string;
  holderName: string;
}

export interface ScheduleDraft {
  mode: 'now' | 'later' | 'recurring';
  /** ISO date (`yyyy-mm-dd`) of the first execution when not `now`. */
  startsOn: string;
  frequency: FrequencyValue;
  /** Optional ISO end date for recurring transfers. */
  endsOn: string;
}

export interface TransferDraft {
  rail: TransferRail;
  fromAccountId: string;
  amountMinorUnits: number | null;
  reference: string;
  destination: DestinationDraft;
  schedule: ScheduleDraft;
  /** Persist the destination as a payee / template after a successful send. */
  saveBeneficiary: boolean;
  templateName: string;
}

export function emptyDestination(): DestinationDraft {
  return {
    mode: 'new',
    beneficiaryId: '',
    accountId: '',
    accountNumber: '',
    sortCode: '',
    iban: '',
    bic: '',
    country: '',
    bankName: '',
    holderName: '',
  };
}

export function initialDraft(rail: TransferRail, fromAccountId: string): TransferDraft {
  return {
    rail,
    fromAccountId,
    amountMinorUnits: null,
    reference: '',
    destination: emptyDestination(),
    schedule: { mode: 'now', startsOn: '', frequency: 'monthly', endsOn: '' },
    saveBeneficiary: false,
    templateName: '',
  };
}
