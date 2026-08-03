import type {
  TransferDestination,
  TransferRail,
  TransferStatus,
  TransactionStatus,
} from '@icb/contracts';
import type { Money } from '@icb/money';

import type { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import type { FeeLine } from '../domain/transfer-fees.js';

/**
 * The pipeline's carrier type.
 *
 * `PreparedTransfer` is everything the common pipeline learned before a rail got involved; a
 * use-case consumes it and must not need to re-ask any of these questions. That is what keeps
 * the rail classes small: all policy is upstream, only the destination leg is theirs.
 */
export interface PreparedTransfer {
  readonly customerId: string;
  readonly transferId: string;
  readonly reference: string;
  readonly destination: TransferDestination;
  readonly rail: TransferRail;
  readonly source: AccountDoc;
  readonly debit: Money;
  readonly credit: Money;
  readonly fx: FxTerms | null;
  readonly fees: readonly FeeLine[];
  readonly totalFees: Money;
  readonly recipientName: string;
  readonly recipientMasked: string;
  readonly customerReference: string | null;
  readonly note: string | null;
  readonly quoteId: string | null;
  readonly now: Date;
}

export interface FxTerms {
  readonly rate: number;
  readonly spreadBps: number;
  readonly roundingDelta: number;
}

/** What a rail use-case decided: how the posting was booked and when value lands. */
export interface TransferExecution {
  readonly transactionId: string;
  readonly status: TransferStatus;
  readonly ledgerStatus: TransactionStatus;
  readonly estimatedArrival: Date;
  readonly railReference: string | null;
  readonly detail: string | null;
}
