import type {
  TransferDestination,
  TransferDetail,
  TransferQuote,
  TransferRail,
} from '@icb/contracts';

/** Discriminated results so the wizard never has to catch or match error strings. */
export type ActionResult<TData> =
  | { ok: true; data: TData }
  | { ok: false; error: string };

export interface QuoteInput {
  fromAccountId: string;
  destination: TransferDestination;
  amountMinorUnits: number;
  currency: string;
  rail: TransferRail;
  reference?: string;
}

export interface ConfirmInput extends QuoteInput {
  quoteId: string;
  schedule?: {
    rrule?: string;
    startsOn: string;
    endsOn?: string;
  };
  saveBeneficiary: boolean;
  /** When set, the confirmed terms are also saved as a reusable template. */
  templateName?: string;
}

export interface ConfirmOutput {
  transfer: TransferDetail;
}

export type QuoteOutput = TransferQuote;
