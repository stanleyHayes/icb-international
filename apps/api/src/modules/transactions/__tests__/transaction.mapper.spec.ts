import { describe, expect, it } from 'vitest';

import type {
  LedgerEntryDoc,
  LedgerTransactionDoc,
} from '../../ledger/infrastructure/ledger.schemas.js';
import type { TransactionAnnotationDoc } from '../infrastructure/transaction-annotation.schemas.js';
import { toDetail, toPosting, toSummary } from '../infrastructure/transaction.mapper.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');

function entryRow(overrides: Partial<LedgerEntryDoc> = {}): LedgerEntryDoc {
  return {
    _id: '01JENTRY000000000000000A',
    transactionId: '01JTXN0000000000000000A',
    accountRef: 'acct:acct-1',
    direction: 'debit',
    minorUnits: 10_000,
    currency: 'USD',
    signedMinorUnits: -10_000,
    valueDate: '2026-08-02',
    bookedAt: NOW,
    sequence: 0,
    narrative: null,
    transactionType: 'deposit',
    transactionStatus: 'posted',
    ...overrides,
  };
}

function headerRow(overrides: Partial<LedgerTransactionDoc> = {}): LedgerTransactionDoc {
  return {
    _id: '01JTXN0000000000000000A',
    reference: 'TXN-2026-000001',
    type: 'deposit',
    status: 'posted',
    description: 'Opening deposit',
    actor: { kind: 'system', id: null, label: 'seed' },
    valueDate: '2026-08-02',
    bookedAt: NOW,
    settledAt: null,
    reversesTransactionId: null,
    reversedByTransactionId: null,
    sourceType: null,
    sourceId: null,
    correlationId: null,
    metadata: {},
    ...overrides,
  };
}

describe('toSummary', () => {
  it('prefers the entry narrative, then the header description, then a default', () => {
    const base = { runningMinorUnits: null, categoryOverride: null };

    expect(toSummary(entryRow({ narrative: 'Coffee' }), headerRow(), base).description).toBe(
      'Coffee',
    );
    expect(toSummary(entryRow(), headerRow(), base).description).toBe('Opening deposit');
    expect(toSummary(entryRow(), undefined, base).description).toBe('Transaction');
  });

  it('falls back to the transaction id for the reference when the header is missing', () => {
    const summary = toSummary(entryRow(), undefined, {
      runningMinorUnits: null,
      categoryOverride: null,
    });

    expect(summary.reference).toBe(entryRow().transactionId);
    expect(summary.runningBalance).toBeNull();
  });

  it('lets a customer category override win over the categoriser', () => {
    const summary = toSummary(entryRow(), headerRow(), {
      runningMinorUnits: 90_000,
      categoryOverride: 'groceries',
    });

    expect(summary.category).toBe('groceries');
    expect(summary.runningBalance).toMatchObject({ minorUnits: 90_000, currency: 'USD' });
  });

  it('flags only non-final statuses as pending', () => {
    const extras = { runningMinorUnits: null, categoryOverride: null };

    expect(toSummary(entryRow({ transactionStatus: 'posted' }), headerRow(), extras).pending).toBe(
      false,
    );
    expect(
      toSummary(entryRow({ transactionStatus: 'settled' }), headerRow(), extras).pending,
    ).toBe(false);
    expect(
      toSummary(entryRow({ transactionStatus: 'pending_auth' }), headerRow(), extras).pending,
    ).toBe(true);
  });

  it('strips the acct: prefix for the account id', () => {
    const summary = toSummary(entryRow(), headerRow(), {
      runningMinorUnits: null,
      categoryOverride: null,
    });

    expect(summary.accountId).toBe('acct-1');
    expect(summary.bookedAt).toBe(NOW.toISOString());
  });
});

describe('toDetail', () => {
  it('defaults the annotation layer when none exists', () => {
    const detail = toDetail(entryRow(), {
      header: headerRow(),
      entries: [entryRow()],
      annotation: null,
      runningMinorUnits: null,
    });

    expect(detail.note).toBeNull();
    expect(detail.tags).toEqual([]);
    expect(detail.attachmentCount).toBe(0);
    expect(detail.postings).toHaveLength(1);
    expect(detail.relatedTransferId).toBeNull();
    expect(detail.settledAt).toBeNull();
  });

  it('applies the annotation layer and cross-references', () => {
    const annotation = {
      category: 'dining',
      note: 'Team lunch',
      tags: ['work'],
      attachments: [{ id: 'a1' }],
    } as unknown as TransactionAnnotationDoc;
    const header = headerRow({
      sourceType: 'transfer',
      sourceId: 'trf-1',
      reversesTransactionId: 'txn-0',
      reversedByTransactionId: 'txn-2',
      settledAt: NOW,
      metadata: { rail: 'internal' },
    });

    const detail = toDetail(entryRow(), {
      header,
      entries: [entryRow()],
      annotation,
      runningMinorUnits: 50_000,
    });

    expect(detail.category).toBe('dining');
    expect(detail.note).toBe('Team lunch');
    expect(detail.attachmentCount).toBe(1);
    expect(detail.relatedTransferId).toBe('trf-1');
    expect(detail.relatedCardId).toBeNull();
    expect(detail.reversalOfId).toBe('txn-0');
    expect(detail.reversedById).toBe('txn-2');
    expect(detail.settledAt).toBe(NOW.toISOString());
    expect(detail.metadata).toEqual({ rail: 'internal' });
  });

  it('links a card source only when the source kind matches', () => {
    const detail = toDetail(entryRow(), {
      header: headerRow({ sourceType: 'card', sourceId: 'card-1' }),
      entries: [],
      annotation: null,
      runningMinorUnits: null,
    });

    expect(detail.relatedCardId).toBe('card-1');
    expect(detail.relatedTransferId).toBeNull();
  });
});

describe('toPosting', () => {
  it('maps the entry fields directly', () => {
    const posting = toPosting(entryRow({ sequence: 3 }));

    expect(posting).toEqual({
      id: entryRow()._id,
      accountLabel: 'acct:acct-1',
      direction: 'debit',
      amount: { minorUnits: 10_000, currency: 'USD', scale: 2 },
      valueDate: '2026-08-02',
      sequence: 3,
    });
  });
});
