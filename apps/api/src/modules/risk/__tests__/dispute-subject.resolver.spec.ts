import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import type { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import type { LedgerEntryDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import { DisputeSubjectResolver } from '../application/dispute-subject.resolver.js';
import {
  ACCOUNT_ID,
  CUSTOMER_ID,
  TRANSACTION_ID,
  accountDoc,
  chainQuery,
  customerDoc,
  ledgerEntryDoc,
} from './fixtures.js';

interface SetupOptions {
  readonly accounts?: AccountDoc[];
  readonly entries?: LedgerEntryDoc[];
  readonly customer?: CustomerDoc | null;
}

function setup(options: SetupOptions = {}) {
  const accounts = options.accounts ?? [accountDoc()];
  const entries = options.entries ?? [ledgerEntryDoc()];
  const customer = options.customer === undefined ? customerDoc() : options.customer;

  const entryQuery = chainQuery(entries);
  const entryModel = { find: vi.fn().mockReturnValue(entryQuery) };
  const accountQuery = chainQuery(accounts);
  const accountModel = { find: vi.fn().mockReturnValue(accountQuery) };
  const customerModel = { findById: vi.fn().mockReturnValue(chainQuery(customer)) };

  const resolver = new DisputeSubjectResolver(
    entryModel as unknown as Model<LedgerEntryDoc>,
    accountModel as unknown as Model<AccountDoc>,
    customerModel as unknown as Model<CustomerDoc>,
  );
  return { resolver, entryModel, entryQuery, accountModel, accountQuery, customerModel };
}

describe('DisputeSubjectResolver.resolve', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('resolves the debit leg on the customer account into a dispute subject', async () => {
    const subject = await deps.resolver.resolve(CUSTOMER_ID, TRANSACTION_ID);

    expect(deps.accountModel.find).toHaveBeenCalledWith({ customerId: CUSTOMER_ID });
    expect(deps.accountQuery.select).toHaveBeenCalledWith('_id');
    expect(deps.entryModel.find).toHaveBeenCalledWith({
      transactionId: TRANSACTION_ID,
      accountRef: { $in: [`acct:${ACCOUNT_ID}`] },
    });
    expect(subject).toEqual({
      accountId: ACCOUNT_ID,
      amountMinorUnits: 25_000,
      currency: 'GBP',
      customerName: 'Ama Mensah',
      description: 'Shoprite Accra',
    });
  });

  it('picks the debit leg when the transaction posted both directions', async () => {
    deps = setup({
      entries: [
        ledgerEntryDoc({ direction: 'credit', minorUnits: 25_000 }),
        ledgerEntryDoc({ direction: 'debit', minorUnits: 25_000 }),
      ],
    });

    const subject = await deps.resolver.resolve(CUSTOMER_ID, TRANSACTION_ID);

    expect(subject.amountMinorUnits).toBe(25_000);
  });

  it('falls back to a generic description when the entry carries no narrative', async () => {
    deps = setup({ entries: [ledgerEntryDoc({ narrative: null })] });

    const subject = await deps.resolver.resolve(CUSTOMER_ID, TRANSACTION_ID);

    expect(subject.description).toBe('Card or transfer payment');
  });

  it('rejects as not-found without querying entries when the customer holds no accounts', async () => {
    deps = setup({ accounts: [] });

    await expect(deps.resolver.resolve(CUSTOMER_ID, TRANSACTION_ID)).rejects.toThrow(
      NotFoundError,
    );
    expect(deps.entryModel.find).not.toHaveBeenCalled();
  });

  it('rejects as not-found when no entry for the transaction sits on the customer accounts', async () => {
    deps = setup({ entries: [] });

    await expect(deps.resolver.resolve(CUSTOMER_ID, TRANSACTION_ID)).rejects.toThrow(
      NotFoundError,
    );
  });

  it('rejects a dispute against money that came in — only debits can be charged back', async () => {
    deps = setup({ entries: [ledgerEntryDoc({ direction: 'credit' })] });

    await expect(deps.resolver.resolve(CUSTOMER_ID, TRANSACTION_ID)).rejects.toThrow(
      ConflictError,
    );
  });

  it('rejects as not-found when the customer record itself is gone', async () => {
    deps = setup({ customer: null });

    await expect(deps.resolver.resolve(CUSTOMER_ID, TRANSACTION_ID)).rejects.toThrow(
      NotFoundError,
    );
  });
});
