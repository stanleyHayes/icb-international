import type { TransactionQuery } from '@icb/contracts';
import { describe, expect, it } from 'vitest';

import { SETTLED_STATUSES } from '../transactions.constants.js';
import { buildEntryFilter, newerThanClause } from '../domain/transaction-filters.js';

const REFS = ['acct:acct-1'];

function query(overrides: Partial<TransactionQuery> = {}): TransactionQuery {
  return overrides as TransactionQuery;
}

describe('buildEntryFilter', () => {
  it('always scopes to the account refs and excludes pending by default', () => {
    const filter = buildEntryFilter(REFS, query());

    expect(filter).toEqual({
      accountRef: { $in: REFS },
      transactionStatus: { $in: SETTLED_STATUSES },
    });
  });

  it('keeps an explicit status list when pending rows are included', () => {
    const filter = buildEntryFilter(REFS, query({ includePending: true, status: ['posted'] }));

    expect(filter['transactionStatus']).toEqual({ $in: ['posted'] });
  });

  it('lets the settled-status override win over an explicit status filter', () => {
    const filter = buildEntryFilter(REFS, query({ status: ['pending_auth'] }));

    expect(filter['transactionStatus']).toEqual({ $in: SETTLED_STATUSES });
  });

  it('adds one clause per supplied parameter', () => {
    const filter = buildEntryFilter(
      REFS,
      query({
        cursor: '01JCURSOR',
        direction: 'debit',
        type: ['deposit', 'withdrawal'],
        currency: 'USD',
        from: '2026-08-01',
        to: '2026-08-31',
        minMinorUnits: 1_000,
        maxMinorUnits: 50_000,
      }),
    );

    expect(filter).toMatchObject({
      _id: { $lt: '01JCURSOR' },
      direction: 'debit',
      transactionType: { $in: ['deposit', 'withdrawal'] },
      currency: 'USD',
      valueDate: { $gte: '2026-08-01', $lte: '2026-08-31' },
      minorUnits: { $gte: 1_000, $lte: 50_000 },
    });
  });

  it('omits clauses whose parameters are absent or empty', () => {
    const filter = buildEntryFilter(REFS, query({ type: [], status: [], includePending: true }));

    expect(filter).toEqual({ accountRef: { $in: REFS } });
  });

  it('supports open-ended date and amount ranges', () => {
    const fromOnly = buildEntryFilter(REFS, query({ from: '2026-08-01', includePending: true }));
    const maxOnly = buildEntryFilter(REFS, query({ maxMinorUnits: 5_000, includePending: true }));

    expect(fromOnly['valueDate']).toEqual({ $gte: '2026-08-01' });
    expect(maxOnly['minorUnits']).toEqual({ $lte: 5_000 });
  });

  it('escapes regex metacharacters in free-text search', () => {
    const filter = buildEntryFilter(REFS, query({ q: 'refund (2nd) $100.*', includePending: true }));

    expect(filter['narrative']).toEqual({
      $regex: 'refund \\(2nd\\) \\$100\\.\\*',
      $options: 'i',
    });
  });
});

describe('newerThanClause', () => {
  it('matches strictly newer rows in page sort order', () => {
    const bookedAt = new Date('2026-08-04T10:00:00.000Z');

    expect(newerThanClause(bookedAt, '01JID')).toEqual({
      $or: [{ bookedAt: { $gt: bookedAt } }, { bookedAt, _id: { $gt: '01JID' } }],
    });
  });
});
