import type { EntryDirection, TransactionStatus, TransactionType } from '@icb/contracts';
import type { Money } from '@icb/money';

import type { AccountRef } from './account-ref.js';
import type { NormalSide } from './chart-of-accounts.js';

/** One leg of a transaction: a single account moved in a single direction by a single amount. */
export interface PostingLine {
  readonly accountRef: AccountRef;
  readonly direction: EntryDirection;
  readonly amount: Money;
  /**
   * Normal side of the target account, used to decide whether this leg increases or decreases
   * its balance. Defaults to `credit` (customer deposit liability) when omitted.
   */
  readonly normalSide?: NormalSide;
  readonly valueDate?: string;
  readonly narrative?: string;
}

export interface PostingActor {
  readonly kind: 'customer' | 'staff' | 'system';
  readonly id: string | null;
  readonly label: string;
}

/**
 * A request to write a balanced transaction.
 *
 * The caller supplies both sides. LedgerService will not invent a contra leg — a transaction
 * whose author has not decided where the other half of the money came from is a bug, not
 * something to paper over with a suspense posting.
 */
export interface PostingCommand {
  readonly type: TransactionType;
  readonly description: string;
  readonly actor: PostingActor;
  readonly lines: readonly PostingLine[];
  readonly status?: TransactionStatus;
  readonly reference?: string;
  readonly valueDate?: string;
  readonly correlationId?: string;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly reversesTransactionId?: string;
  /** Links the posting back to the transfer, card authorisation, or loan that caused it. */
  readonly sourceType?: string;
  readonly sourceId?: string;
}

export interface PostedEntry {
  readonly id: string;
  readonly accountRef: AccountRef;
  readonly direction: EntryDirection;
  readonly amount: Money;
  readonly sequence: number;
  readonly valueDate: string;
}

export interface PostedTransaction {
  readonly id: string;
  readonly reference: string;
  readonly type: TransactionType;
  readonly status: TransactionStatus;
  readonly description: string;
  readonly entries: readonly PostedEntry[];
  readonly bookedAt: Date;
}
