import type { EntryDirection, TransactionStatus, TransactionType } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';

import { UnbalancedPostingError } from '../errors.js';
import type { FactoryContext } from '../core/context.js';
import { MAX_AMOUNT_MINOR_UNITS, MIN_AMOUNT_MINOR_UNITS } from '../testing.constants.js';

/**
 * Ledger persistence shapes.
 *
 * Plain-object mirrors of `apps/api/src/modules/ledger/infrastructure/ledger.schemas.ts` (the
 * contracts package deliberately has no ledger wire schema — postings never leave the backend
 * in this form). Factories here are for seeding Mongo directly in integration tests.
 */

export type NormalSide = 'debit' | 'credit';

export interface TestLedgerEntry {
  readonly _id: string;
  readonly transactionId: string;
  readonly accountRef: string;
  readonly direction: EntryDirection;
  readonly minorUnits: number;
  readonly currency: string;
  readonly signedMinorUnits: number;
  readonly valueDate: string;
  readonly bookedAt: Date;
  readonly sequence: number;
  readonly narrative: string | null;
  readonly transactionType: string;
  readonly transactionStatus: string;
}

export interface TestLedgerTransaction {
  readonly _id: string;
  readonly reference: string;
  readonly type: TransactionType;
  readonly status: TransactionStatus;
  readonly description: string;
  readonly actor: { kind: string; id: string | null; label: string };
  readonly valueDate: string;
  readonly bookedAt: Date;
  readonly settledAt: Date | null;
  readonly reversesTransactionId: string | null;
  readonly reversedByTransactionId: string | null;
  readonly sourceType: string | null;
  readonly sourceId: string | null;
  readonly correlationId: string | null;
  readonly metadata: Record<string, string>;
  readonly entries: readonly TestLedgerEntry[];
}

export interface LedgerLineInput {
  /** `acct:<accountId>` for customer accounts, `gl:<code>` for internal accounts. */
  readonly accountRef: string;
  readonly direction: EntryDirection;
  readonly minorUnits: number;
  /** Normal side of the target account; decides the sign of `signedMinorUnits`. */
  readonly normalSide?: NormalSide;
  readonly narrative?: string;
}

export interface LedgerPostingOptions {
  readonly lines?: readonly LedgerLineInput[];
  readonly currency?: CurrencyCode;
  readonly type?: TransactionType;
  readonly status?: TransactionStatus;
  readonly description?: string;
  readonly actor?: { kind: string; id: string | null; label: string };
  readonly metadata?: Record<string, string>;
  readonly reversesTransactionId?: string;
  readonly sourceType?: string;
  readonly sourceId?: string;
}

export interface LedgerEntryMeta {
  readonly sequence: number;
  readonly transactionId: string;
  readonly type: TransactionType;
  readonly status: TransactionStatus;
  readonly currency: CurrencyCode;
}

const DEFAULT_NORMAL_SIDE: NormalSide = 'credit';

/**
 * Balanced ledger transaction factory.
 *
 * Validates the double-entry invariant (agent_plan.md N4) before returning: debits must equal
 * credits per currency, or the factory throws rather than seed a corrupt ledger. Default (no
 * lines): a deposit — debit `gl:1000` cash, credit a generated customer account.
 */
export function ledgerTransaction(
  ctx: FactoryContext,
  options: LedgerPostingOptions = {},
): TestLedgerTransaction {
  const currency = options.currency ?? 'GHS';
  const lines = options.lines ?? defaultLines(ctx);
  assertBalanced(lines, currency);
  const transactionId = ctx.nextId();
  const type = options.type ?? 'deposit';
  const status = options.status ?? 'posted';
  const base: TestLedgerTransaction = {
    _id: transactionId,
    reference: ctx.reference('LED'),
    type,
    status,
    description: options.description ?? 'Test posting',
    actor: options.actor ?? { kind: 'system', id: null, label: 'test-harness' },
    valueDate: ctx.clock.today(),
    bookedAt: ctx.clock.now(),
    settledAt: status === 'settled' || status === 'posted' ? ctx.clock.now() : null,
    reversesTransactionId: options.reversesTransactionId ?? null,
    reversedByTransactionId: null,
    sourceType: options.sourceType ?? null,
    sourceId: options.sourceId ?? null,
    correlationId: null,
    metadata: options.metadata ?? {},
    entries: lines.map((line, index) =>
      buildEntry(ctx, line, { sequence: index, transactionId, type, status, currency }),
    ),
  };
  return base;
}

function buildEntry(
  ctx: FactoryContext,
  line: LedgerLineInput,
  meta: LedgerEntryMeta,
): TestLedgerEntry {
  const normalSide = line.normalSide ?? DEFAULT_NORMAL_SIDE;
  const signed = line.direction === normalSide ? line.minorUnits : -line.minorUnits;
  return {
    _id: ctx.nextId(),
    transactionId: meta.transactionId,
    accountRef: line.accountRef,
    direction: line.direction,
    minorUnits: line.minorUnits,
    currency: meta.currency,
    signedMinorUnits: signed,
    valueDate: ctx.clock.today(),
    bookedAt: ctx.clock.now(),
    sequence: meta.sequence,
    narrative: line.narrative ?? null,
    transactionType: meta.type,
    transactionStatus: meta.status,
  };
}

function defaultLines(ctx: FactoryContext): readonly LedgerLineInput[] {
  const minorUnits = ctx.intBetween(MIN_AMOUNT_MINOR_UNITS, MAX_AMOUNT_MINOR_UNITS);
  return [
    { accountRef: 'gl:1000', direction: 'debit', minorUnits, normalSide: 'debit' },
    { accountRef: `acct:${ctx.nextId()}`, direction: 'credit', minorUnits },
  ];
}

/** N4: Σ debits must equal Σ credits. Anything else is a bug in the test, so fail loudly. */
function assertBalanced(lines: readonly LedgerLineInput[], currency: CurrencyCode): void {
  let debits = 0;
  let credits = 0;
  for (const line of lines) {
    if (line.direction === 'debit') {
      debits += line.minorUnits;
    } else {
      credits += line.minorUnits;
    }
  }
  if (debits !== credits) {
    throw new UnbalancedPostingError(currency, debits, credits);
  }
}
