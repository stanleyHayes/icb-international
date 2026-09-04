import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { groupTransactionsByDay, TransactionList, transactionRowKey } from '../transaction-list';
import { makeTransaction } from './transaction.fixture';

const MONDAY = makeTransaction({ id: 'a'.padEnd(26, '1'), bookedAt: '2026-01-12T09:00:00Z' });
const MONDAY_LATE = makeTransaction({ id: 'b'.padEnd(26, '2'), bookedAt: '2026-01-12T21:00:00Z' });
const TUESDAY = makeTransaction({ id: 'c'.padEnd(26, '3'), bookedAt: '2026-01-13T10:00:00Z' });

/** Both legs of one transfer between two accounts the same customer owns. */
const SELF_TRANSFER_ID = 'd'.padEnd(26, '4');
const SELF_DEBIT = makeTransaction({
  id: SELF_TRANSFER_ID,
  accountId: 'from'.padEnd(26, '0'),
  direction: 'debit',
  type: 'transfer_out',
  merchant: null,
  description: 'Move to Reserve',
});
const SELF_CREDIT = makeTransaction({
  id: SELF_TRANSFER_ID,
  accountId: 'to'.padEnd(26, '0'),
  direction: 'credit',
  type: 'transfer_in',
  merchant: null,
  description: 'Move to Reserve',
});

describe('transactionRowKey', () => {
  it('separates the two legs of a transfer between one customer\u2019s own accounts', () => {
    // The legs share a transaction id and differ only by account. Keying on the id alone
    // collided, and React dropped a leg from the statement.
    expect(SELF_DEBIT.id).toBe(SELF_CREDIT.id);
    expect(transactionRowKey(SELF_DEBIT)).not.toBe(transactionRowKey(SELF_CREDIT));
  });
});

describe('groupTransactionsByDay', () => {
  it('groups transactions by calendar day, preserving order', () => {
    const groups = groupTransactionsByDay([MONDAY, MONDAY_LATE, TUESDAY]);
    expect(groups.map((group) => group.day)).toEqual(['2026-01-12', '2026-01-13']);
    expect(groups[0]?.items).toHaveLength(2);
    expect(groups[1]?.items).toHaveLength(1);
  });

  it('returns no groups for an empty statement', () => {
    expect(groupTransactionsByDay([])).toEqual([]);
  });
});

describe('TransactionList', () => {
  it('renders day headings above their rows', () => {
    const html = renderToStaticMarkup(
      <TransactionList transactions={[MONDAY, TUESDAY]} hasMore={false} />,
    );
    expect(html).toContain('2026');
    expect(html).toContain('Corner Market');
  });

  it('renders a skeleton while loading more', () => {
    const html = renderToStaticMarkup(
      <TransactionList transactions={[MONDAY]} hasMore loading onLoadMore={() => undefined} />,
    );
    expect(html).toContain('animate-pulse');
  });

  it('shows an empty state when there is nothing and no load in flight', () => {
    const html = renderToStaticMarkup(<TransactionList transactions={[]} hasMore={false} />);
    expect(html).toContain('No transactions yet');
  });

  it('renders both legs of a self-transfer', () => {
    const html = renderToStaticMarkup(
      <TransactionList transactions={[SELF_DEBIT, SELF_CREDIT]} hasMore={false} />,
    );
    expect(html.split('Move to Reserve').length - 1).toBe(2);
  });

  it('honours a custom empty state', () => {
    const html = renderToStaticMarkup(
      <TransactionList transactions={[]} hasMore={false} emptyState={<p>Quiet account</p>} />,
    );
    expect(html).toContain('Quiet account');
  });
});
