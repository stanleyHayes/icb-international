import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { TransactionRow } from '../transaction-row';
import { makeTransaction } from './transaction.fixture';

describe('TransactionRow', () => {
  it('shows the merchant name, category, and amount', () => {
    const html = renderToStaticMarkup(<TransactionRow transaction={makeTransaction()} />);
    expect(html).toContain('Corner Market');
    expect(html).toContain('groceries');
    expect(html).toContain('45.99');
  });

  it('falls back to the description when there is no merchant or counterparty', () => {
    const html = renderToStaticMarkup(
      <TransactionRow transaction={makeTransaction({ merchant: null })} />,
    );
    expect(html).toContain('Weekly groceries');
  });

  it('credits render with a plus and debits with a minus', () => {
    const credit = renderToStaticMarkup(
      <TransactionRow transaction={makeTransaction({ direction: 'credit' })} />,
    );
    expect(credit).toContain('+');
    const debit = renderToStaticMarkup(<TransactionRow transaction={makeTransaction()} />);
    expect(debit).toMatch(/[−-].{0,20}45\.99/);
  });

  it('badges a non-final status next to the name', () => {
    const html = renderToStaticMarkup(
      <TransactionRow transaction={makeTransaction({ status: 'pending_auth', pending: true })} />,
    );
    expect(html).toContain('pending auth');
  });

  it('shows the running balance when asked and available', () => {
    const html = renderToStaticMarkup(
      <TransactionRow transaction={makeTransaction()} showRunningBalance />,
    );
    expect(html).toContain('12,054.01');
  });

  it('renders as a button when selectable, a div otherwise', () => {
    const interactive = renderToStaticMarkup(
      <TransactionRow transaction={makeTransaction()} onSelect={() => undefined} />,
    );
    expect(interactive).toContain('<button');
    const passive = renderToStaticMarkup(<TransactionRow transaction={makeTransaction()} />);
    expect(passive).not.toContain('<button');
  });
});
