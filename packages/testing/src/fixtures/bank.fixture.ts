import type { AccountDetail, CustomerProfile } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';

import { createFactoryContext, type FactoryContext } from '../core/context.js';
import { accountDetail, savingsAccount } from '../factories/account.factory.js';
import { customerProfile } from '../factories/customer.factory.js';
import { ledgerTransaction, type TestLedgerTransaction } from '../factories/ledger.factory.js';
import { FIXTURE_CURRENCY, FIXTURE_FUNDING_MINOR_UNITS } from '../testing.constants.js';

/**
 * The minimal coherent bank.
 *
 * One active, KYC-approved individual with two accounts: a current account funded by a single
 * posted deposit, and an empty savings account. The invariant that makes it *coherent* rather
 * than three random objects: the current account's ledger balance equals the sum of its ledger
 * entries — exactly what `account_balances` would hold after the funding posted (N4).
 */
export interface MinimalBank {
  readonly context: FactoryContext;
  readonly customer: CustomerProfile;
  readonly currentAccount: AccountDetail;
  readonly savingsAccount: AccountDetail;
  /** The posted deposit that funded `currentAccount` (debit gl:1000, credit the account). */
  readonly funding: TestLedgerTransaction;
}

export interface MinimalBankOptions {
  readonly seed?: number;
  readonly currency?: CurrencyCode;
  readonly fundingMinorUnits?: number;
}

export function minimalBank(options: MinimalBankOptions = {}): MinimalBank {
  const currency = options.currency ?? FIXTURE_CURRENCY;
  const fundingMinorUnits = options.fundingMinorUnits ?? FIXTURE_FUNDING_MINOR_UNITS;
  const context = createFactoryContext({ seed: options.seed });
  const customer = customerProfile(context);
  const currentAccount = accountDetail(context, {
    customerId: customer.id,
    currency,
    ledgerMinorUnits: fundingMinorUnits,
  });
  const funding = fundingDeposit(context, currentAccount.id, fundingMinorUnits, currency);
  return {
    context,
    customer,
    currentAccount,
    savingsAccount: savingsAccount(context, {
      customerId: customer.id,
      currency,
      ledgerMinorUnits: 0,
    }),
    funding,
  };
}

function fundingDeposit(
  ctx: FactoryContext,
  accountId: string,
  minorUnits: number,
  currency: CurrencyCode,
): TestLedgerTransaction {
  return ledgerTransaction(ctx, {
    currency,
    type: 'deposit',
    status: 'posted',
    description: 'Opening deposit',
    lines: [
      { accountRef: 'gl:1000', direction: 'debit', minorUnits, normalSide: 'debit' },
      { accountRef: `acct:${accountId}`, direction: 'credit', minorUnits },
    ],
  });
}
