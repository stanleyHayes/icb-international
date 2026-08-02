import { describe, expect, it } from 'vitest';

import { minimalBank } from '../fixtures/bank.fixture.js';
import { FIXTURE_CURRENCY, FIXTURE_FUNDING_MINOR_UNITS } from '../testing.constants.js';

describe('minimalBank fixture', () => {
  const bank = minimalBank();

  it('links both accounts to the customer', () => {
    expect(bank.currentAccount.customerId).toBe(bank.customer.id);
    expect(bank.savingsAccount.customerId).toBe(bank.customer.id);
  });

  it('funds the current account with a posted deposit', () => {
    expect(bank.funding.status).toBe('posted');
    expect(bank.currentAccount.balances.ledger.minorUnits).toBe(FIXTURE_FUNDING_MINOR_UNITS);
  });

  it('keeps the balance equal to the sum of its ledger entries (N4)', () => {
    const accountRef = `acct:${bank.currentAccount.id}`;
    const sum = bank.funding.entries
      .filter((entry) => entry.accountRef === accountRef)
      .reduce((total, entry) => total + entry.signedMinorUnits, 0);
    expect(sum).toBe(bank.currentAccount.balances.ledger.minorUnits);
  });

  it('leaves the savings account empty but open', () => {
    expect(bank.savingsAccount.kind).toBe('savings');
    expect(bank.savingsAccount.balances.ledger.minorUnits).toBe(0);
    expect(bank.savingsAccount.status).toBe('active');
  });

  it('honours currency and funding overrides', () => {
    const usd = minimalBank({ currency: 'USD', fundingMinorUnits: 10_000 });
    expect(usd.currentAccount.currency).toBe('USD');
    expect(usd.currentAccount.balances.ledger.minorUnits).toBe(10_000);
    expect(usd.funding.entries[0]?.currency).toBe('USD');
    expect(FIXTURE_CURRENCY).toBe('GHS');
  });

  it('is reproducible from a seed', () => {
    const first = minimalBank({ seed: 123 });
    const second = minimalBank({ seed: 123 });
    expect(first.customer).toEqual(second.customer);
    expect(first.funding).toEqual(second.funding);
  });
});
