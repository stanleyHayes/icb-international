import type {
  EntryDirection,
  MoneyDto,
  TransactionStatus,
  TransactionType,
} from '@icb/contracts';

import type { PostingActor } from '../domain/posting.types.js';

/** One immutable posting, as read back through the journal. */
export interface JournalEntry {
  readonly id: string;
  readonly accountRef: string;
  readonly direction: EntryDirection;
  readonly amount: MoneyDto;
  readonly signedMinorUnits: number;
  readonly sequence: number;
  readonly valueDate: string;
  readonly narrative: string | null;
}

/** A balanced transaction header with every entry that moved value under it. */
export interface JournalTransaction {
  readonly transactionId: string;
  readonly reference: string;
  readonly type: TransactionType;
  readonly status: TransactionStatus;
  readonly description: string;
  readonly actor: PostingActor;
  readonly valueDate: string;
  readonly bookedAt: string;
  readonly settledAt: string | null;
  readonly reversesTransactionId: string | null;
  readonly reversedByTransactionId: string | null;
  readonly sourceType: string | null;
  readonly sourceId: string | null;
  readonly entries: JournalEntry[];
}
