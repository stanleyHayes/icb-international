import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import type { LedgerEntryDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import type { TransactionsService } from '../transactions.service.js';
import { TransactionsService as Service } from '../transactions.service.js';

const CUSTOMER_ID = 'cust-1';
const ACCOUNT_ID = 'acct-1';
const REF = `acct:${ACCOUNT_ID}`;

function entry(overrides: Partial<LedgerEntryDoc> = {}): LedgerEntryDoc {
  return {
    _id: 'entry-1',
    transactionId: 'txn-1',
    accountRef: REF,
    direction: 'debit',
    minorUnits: 2_500,
    currency: 'GBP',
    signedMinorUnits: -2_500,
    valueDate: '2026-08-03',
    bookedAt: new Date('2026-08-03T10:00:00Z'),
    sequence: 1,
    narrative: 'Shoprite Accra',
    transactionType: 'card_payment',
    transactionStatus: 'posted',
    ...overrides,
  };
}

function chain(result: unknown) {
  return {
    sort: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

function setup(rows: LedgerEntryDoc[] = [entry()]) {
  const entries = {
    find: vi.fn().mockReturnValue(chain(rows)),
    findOne: vi.fn().mockReturnValue(chain(entry())),
    aggregate: vi.fn().mockResolvedValue([
      { accountRef: REF, currency: 'GBP', sum: -2_500 },
    ]),
  };
  const transactions = {
    find: vi.fn().mockReturnValue(chain([])),
    findById: vi.fn().mockReturnValue(chain(null)),
  };
  const accounts = {
    find: vi.fn().mockReturnValue(chain([{ _id: ACCOUNT_ID }])),
  };
  const annotations = {
    getForTransactions: vi.fn().mockResolvedValue(new Map()),
    getForTransaction: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue({}),
  };
  const service: TransactionsService = new Service(
    entries as never,
    transactions as never,
    accounts as never,
    annotations as never,
  );
  return { service, entries, transactions, accounts, annotations };
}

describe('TransactionsService.list', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('short-circuits with an empty page when the customer has no accounts', async () => {
    deps.accounts.find.mockReturnValue(chain([]));

    const page = await deps.service.list(CUSTOMER_ID, { limit: 10 } as never);

    expect(page).toEqual({ items: [], nextCursor: null, hasMore: false });
    expect(deps.entries.find).not.toHaveBeenCalled();
  });

  it('asks for limit + 1 and reports hasMore with a cursor', async () => {
    deps.entries.find.mockReturnValue(chain([entry(), entry({ _id: 'entry-2' })]));

    const page = await deps.service.list(CUSTOMER_ID, { limit: 1 } as never);

    expect(page.hasMore).toBe(true);
    expect(page.items).toHaveLength(1);
    expect(page.nextCursor).toBe('entry-1');
  });

  it('returns a final page with a null cursor', async () => {
    const page = await deps.service.list(CUSTOMER_ID, { limit: 10 } as never);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('scopes entry lookup to the requested account only', async () => {
    await deps.service.list(CUSTOMER_ID, { limit: 10, accountId: ACCOUNT_ID } as never);
    expect(deps.accounts.find).toHaveBeenCalledWith({ customerId: CUSTOMER_ID, _id: ACCOUNT_ID });
  });

  it('folds category overrides from annotations into the summary', async () => {
    deps.annotations.getForTransactions.mockResolvedValue(
      new Map([['txn-1', { category: 'groceries' }]]),
    );

    const page = await deps.service.list(CUSTOMER_ID, { limit: 10 } as never);
    expect(page.items[0]?.category).toBe('groceries');
  });
});

describe('TransactionsService.detail', () => {
  it('composes header, entries, annotation and running balance', async () => {
    const deps = setup();
    const detail = await deps.service.detail(CUSTOMER_ID, 'txn-1');

    expect(deps.entries.findOne).toHaveBeenCalledWith({
      transactionId: 'txn-1',
      accountRef: { $in: [REF] },
    });
    expect(detail).toMatchObject({ id: 'txn-1' });
  });

  it('throws NotFoundError when no entry belongs to the caller', async () => {
    const deps = setup();
    deps.entries.findOne.mockReturnValue(chain(null));

    await expect(deps.service.detail(CUSTOMER_ID, 'txn-404')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('TransactionsService.annotate', () => {
  it('verifies ownership before writing the annotation', async () => {
    const deps = setup();
    await deps.service.annotate(CUSTOMER_ID, 'txn-1', { category: 'groceries' });

    expect(deps.annotations.upsert).toHaveBeenCalledWith(CUSTOMER_ID, 'txn-1', {
      category: 'groceries',
    });
  });

  it('never writes an annotation on somebody else\'s transaction', async () => {
    const deps = setup();
    deps.entries.findOne.mockReturnValue(chain(null));

    await expect(
      deps.service.annotate(CUSTOMER_ID, 'txn-404', { category: 'groceries' }),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(deps.annotations.upsert).not.toHaveBeenCalled();
  });
});

describe('TransactionsService running balances', () => {
  it('skips the aggregations for an empty page', async () => {
    const deps = setup([]);
    const page = await deps.service.list(CUSTOMER_ID, { limit: 10 } as never);

    expect(page.items).toHaveLength(0);
    expect(deps.entries.aggregate).not.toHaveBeenCalled();
  });

  it('derives running balances from the settled aggregations', async () => {
    const deps = setup();
    const page = await deps.service.list(CUSTOMER_ID, { limit: 10 } as never);

    expect(deps.entries.aggregate).toHaveBeenCalledTimes(2);
    expect(page.items[0]?.runningBalance).toBeDefined();
  });
});
