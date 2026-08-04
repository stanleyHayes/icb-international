import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { groupTransactionsByDay, TransactionList } from '../transaction-list';
import { makeTransaction } from './transaction.fixture';

const MONDAY = makeTransaction({ id: 'a'.padEnd(26, '1'), bookedAt: '2026-01-12T09:00:00Z' });
const MONDAY_LATE = makeTransaction({ id: 'b'.padEnd(26, '2'), bookedAt: '2026-01-12T21:00:00Z' });
const TUESDAY = makeTransaction({ id: 'c'.padEnd(26, '3'), bookedAt: '2026-01-13T10:00:00Z' });

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

  it('honours a custom empty state', () => {
    const html = renderToStaticMarkup(
      <TransactionList transactions={[]} hasMore={false} emptyState={<p>Quiet account</p>} />,
    );
    expect(html).toContain('Quiet account');
  });
});
