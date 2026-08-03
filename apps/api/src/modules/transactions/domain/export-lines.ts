import type { EntryDirection } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';

/**
 * One row of a transaction export, in statement (chronological) order. Format-agnostic: the
 * CSV, OFX, PDF and JSON renderers all consume this shape, so the renderers stay pure string
 * builders and every format shows identical figures.
 */
export interface ExportLine {
  readonly transactionId: string;
  readonly valueDate: string;
  readonly bookedAt: Date;
  readonly description: string;
  readonly type: string;
  readonly category: string;
  readonly direction: EntryDirection;
  /** Signed effect on the account: credits positive, debits negative. */
  readonly signedMinorUnits: number;
  readonly currency: CurrencyCode;
  /** Balance immediately after this line posted. */
  readonly runningMinorUnits: number;
}
