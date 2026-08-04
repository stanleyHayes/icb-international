import { fromMinorUnits } from '@icb/money';
import type { ClientSession, Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import {
  ConflictError,
  LedgerUnbalancedError,
  NotFoundError,
} from '../../../common/errors/index.js';
import { type TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { type MetricsService } from '../../../common/observability/metrics.service.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { PostingCommand, PostingLine } from '../domain/posting.types.js';
import type {
  AccountBalanceDoc,
  LedgerEntryDoc,
  LedgerTransactionDoc,
} from '../infrastructure/ledger.schemas.js';
import { LedgerService } from '../ledger.service.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const SESSION = { id: 'session-1' } as unknown as ClientSession;
const CUSTOMER = 'acct:01J8ZCAAAAAAAAAAAAAAAAAA';
const CASH = 'gl:1000'; // GL cash — debit-normal asset

/** A thenable query chain mirroring how the service consumes Mongoose. */
function queryChain<T>(result: T) {
  return {
    session: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

function depositLines(amount = 10_000): PostingLine[] {
  return [
    { accountRef: CASH, direction: 'debit', amount: fromMinorUnits(amount, 'USD') },
    { accountRef: CUSTOMER, direction: 'credit', amount: fromMinorUnits(amount, 'USD') },
  ];
}

function command(overrides: Partial<PostingCommand> = {}): PostingCommand {
  return {
    type: 'deposit',
    description: 'Opening deposit',
    actor: { kind: 'system', id: null, label: 'seed' },
    lines: depositLines(),
    ...overrides,
  };
}

function entryRow(overrides: Partial<LedgerEntryDoc> = {}): LedgerEntryDoc {
  return {
    _id: '01JENTRY000000000000000A',
    transactionId: '01JTXN0000000000000000A',
    accountRef: CASH,
    direction: 'debit',
    minorUnits: 10_000,
    currency: 'USD',
    signedMinorUnits: 10_000,
    valueDate: '2026-08-02',
    bookedAt: NOW,
    sequence: 0,
    narrative: null,
    transactionType: 'deposit',
    transactionStatus: 'posted',
    ...overrides,
  };
}

function setup({
  original = null as LedgerTransactionDoc | null,
  originalEntries = [] as LedgerEntryDoc[],
} = {}) {
  // updateOne's result is awaited directly or via `.session(session)` — a thenable chain.
  const updateChain = () => ({
    session: vi.fn().mockReturnThis(),
    then(onFulfilled?: (value: { matchedCount: number }) => unknown) {
      return Promise.resolve({ matchedCount: 1 }).then(onFulfilled);
    },
  });
  const transactions = {
    create: vi.fn().mockResolvedValue([]),
    findById: vi.fn().mockReturnValue(queryChain(original)),
    updateOne: vi.fn().mockImplementation(updateChain),
  };
  const entries = {
    insertMany: vi.fn().mockResolvedValue([]),
    find: vi.fn().mockReturnValue(queryChain(originalEntries)),
  };
  const balances = {
    findOne: vi.fn().mockReturnValue(queryChain(null)),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const transactionManager = {
    // Both parameters are declared, not just the callback: the lock keys are the second argument
    // and a test below asserts on them, which it cannot do if the mock's signature drops them.
    withTransaction: vi.fn(
      (fn: (session: ClientSession) => unknown, _options?: { lockKeys?: readonly string[] }) =>
        fn(SESSION),
    ),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const metrics = { ledgerPosting: vi.fn() };
  const service = new LedgerService(
    transactions as unknown as Model<LedgerTransactionDoc>,
    entries as unknown as Model<LedgerEntryDoc>,
    balances as unknown as Model<AccountBalanceDoc>,
    transactionManager as unknown as TransactionManager,
    clock,
    metrics as unknown as MetricsService,
  );
  return { service, transactions, entries, balances, transactionManager };
}

describe('LedgerService.post', () => {
  it('opens a transaction locked on every touched balance', async () => {
    const { service, transactionManager } = setup();

    await service.post(command());

    expect(transactionManager.withTransaction).toHaveBeenCalledOnce();
    const [, options] = transactionManager.withTransaction.mock.calls[0] as [
      unknown,
      { lockKeys: string[] },
    ];
    expect(options.lockKeys).toHaveLength(2);
  });
});

describe('LedgerService.postWithin', () => {
  it('rejects an unbalanced transaction before any write', async () => {
    const { service, transactions } = setup();
    const lines = [
      { accountRef: CASH, direction: 'debit', amount: fromMinorUnits(10_000, 'USD') },
      { accountRef: CUSTOMER, direction: 'credit', amount: fromMinorUnits(9_999, 'USD') },
    ] as PostingLine[];

    await expect(service.postWithin(command({ lines }), SESSION)).rejects.toBeInstanceOf(
      LedgerUnbalancedError,
    );
    expect(transactions.create).not.toHaveBeenCalled();
  });

  it('rejects a single-line transaction', async () => {
    const { service } = setup();

    await expect(
      service.postWithin(command({ lines: [depositLines()[0]!] }), SESSION),
    ).rejects.toBeInstanceOf(LedgerUnbalancedError);
  });

  it('rejects a non-positive amount', async () => {
    const { service } = setup();

    await expect(service.postWithin(command({ lines: depositLines(0) }), SESSION))
      .rejects.toBeInstanceOf(LedgerUnbalancedError);
  });

  it('writes header, signed entries, and balance deltas atomically', async () => {
    const { service, transactions, entries, balances } = setup();

    const posted = await service.postWithin(command(), SESSION);

    const [header] = transactions.create.mock.calls[0] as [Record<string, unknown>[]];
    expect(header[0]).toMatchObject({
      type: 'deposit',
      status: 'posted',
      valueDate: '2026-08-02',
      bookedAt: NOW,
      reversedByTransactionId: null,
    });
    expect(String(header[0]?.reference)).toMatch(/^TXN-/);

    const [docs] = entries.insertMany.mock.calls[0] as [Record<string, unknown>[]];
    expect(docs).toHaveLength(2);
    expect(docs[0]).toMatchObject({ accountRef: CASH, direction: 'debit', signedMinorUnits: 10_000 });
    expect(docs[1]).toMatchObject({
      accountRef: CUSTOMER,
      direction: 'credit',
      signedMinorUnits: 10_000,
    });

    expect(balances.updateOne).toHaveBeenCalledTimes(2);
    const [cashFilter, cashUpdate] = balances.updateOne.mock.calls[0] as [
      unknown,
      { $inc: Record<string, number> },
    ];
    expect(cashFilter).toEqual({ accountRef: CASH, currency: 'USD' });
    expect(cashUpdate.$inc).toMatchObject({
      ledgerMinorUnits: 10_000,
      debitMinorUnits: 10_000,
      creditMinorUnits: 0,
      entryCount: 1,
    });

    expect(posted.status).toBe('posted');
    expect(posted.bookedAt).toEqual(NOW);
    expect(posted.entries).toHaveLength(2);
    expect(posted.entries[1]?.amount.minorUnits).toBe(10_000);
  });

  it('honours an explicit reference, status, and value date', async () => {
    const { service, transactions } = setup();

    const posted = await service.postWithin(
      // 'authorised' rather than the default 'posted': it is what an outbound rail books while
      // the money is in flight, so this exercises a status the ledger genuinely writes.
      command({ reference: 'TXN-CUSTOM-1', status: 'authorised', valueDate: '2026-08-01' }),
      SESSION,
    );

    const [header] = transactions.create.mock.calls[0] as [Record<string, unknown>[]];
    expect(header[0]).toMatchObject({
      reference: 'TXN-CUSTOM-1',
      status: 'authorised',
      valueDate: '2026-08-01',
    });
    expect(posted.reference).toBe('TXN-CUSTOM-1');
  });
});

describe('LedgerService.reverse', () => {
  const original = {
    _id: '01JTXN0000000000000000A',
    reference: 'TXN-2026-000001',
    reversedByTransactionId: null,
  } as LedgerTransactionDoc;

  it('throws NotFoundError when the original transaction does not exist', async () => {
    const { service } = setup({ original: null, originalEntries: depositEntries() });

    await expect(
      service.reverse('missing', 'duplicate', { kind: 'system', id: null, label: 'ops' }),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it('throws ConflictError when the transaction was already reversed', async () => {
    const { service } = setup({
      original: { ...original, reversedByTransactionId: '01JREV' },
      originalEntries: depositEntries(),
    });

    await expect(
      service.reverse(original._id, 'duplicate', { kind: 'system', id: null, label: 'ops' }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('posts the mirror image and marks the original reversed', async () => {
    const { service, entries, transactions } = setup({
      original,
      originalEntries: depositEntries(),
    });

    const reversal = await service.reverse(original._id, 'duplicate deposit', {
      kind: 'system',
      id: null,
      label: 'ops',
    });

    const [docs] = entries.insertMany.mock.calls[0] as [Record<string, unknown>[]];
    expect(docs[0]).toMatchObject({ accountRef: CASH, direction: 'credit' });
    expect(docs[1]).toMatchObject({ accountRef: CUSTOMER, direction: 'debit' });

    expect(transactions.updateOne).toHaveBeenCalledWith(
      { _id: original._id },
      { $set: { status: 'reversed', reversedByTransactionId: reversal.id } },
      { session: SESSION },
    );
    expect(reversal.type).toBe('reversal');
    expect(String(reversal.reference)).toMatch(/^REV-/);
  });

  function depositEntries(): LedgerEntryDoc[] {
    return [
      entryRow(),
      entryRow({
        _id: '01JENTRY000000000000000B',
        accountRef: CUSTOMER,
        direction: 'credit',
        signedMinorUnits: 10_000,
        sequence: 1,
      }),
    ];
  }
});

describe('LedgerService.getBalance', () => {
  it('returns the cached ledger balance as money', async () => {
    const { service, balances } = setup();
    balances.findOne.mockReturnValue(queryChain({ ledgerMinorUnits: 42_000 }));

    const balance = await service.getBalance(CUSTOMER, 'USD');

    expect(balance).toMatchObject({ minorUnits: 42_000, currency: 'USD' });
  });

  it('returns zero for an account that has never been posted to', async () => {
    const { service } = setup();

    const balance = await service.getBalance(CUSTOMER, 'USD');

    expect(balance.minorUnits).toBe(0);
  });
});

describe('LedgerService.markSettled', () => {
  it('marks settled inside a supplied session', async () => {
    const { service, transactions } = setup();

    await service.markSettled('txn-1', SESSION);

    const [filter, update] = transactions.updateOne.mock.calls[0] as [unknown, unknown];
    expect(filter).toEqual({ _id: 'txn-1' });
    expect(update).toEqual({ $set: { status: 'settled', settledAt: NOW } });
  });

  it('marks settled without a session', async () => {
    const { service, transactions } = setup();

    await service.markSettled('txn-1');

    expect(transactions.updateOne).toHaveBeenCalledOnce();
  });
});

describe('LedgerService.isInternal', () => {
  it('distinguishes GL accounts from customer accounts', () => {
    const { service } = setup();

    expect(service.isInternal(CASH)).toBe(true);
    expect(service.isInternal(CUSTOMER)).toBe(false);
  });
});
