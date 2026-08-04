import type { ClientSession, Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { customerRef, glRef } from '../domain/account-ref.js';
import { GL_CASH } from '../domain/chart-of-accounts.js';
import type {
  AccountBalanceDoc,
  LedgerEntryDoc,
  LedgerTransactionDoc,
} from '../infrastructure/ledger.schemas.js';
import { LedgerService } from '../ledger.service.js';
import { metricsStub } from '../../../common/observability/__tests__/metrics.stub.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');
const SESSION = { id: 'fake-session' } as unknown as ClientSession;
const CASH = glRef(GL_CASH);
const CUSTOMER = customerRef('01JACC0000000000000000A');
const ORIGINAL_ID = '01JTXN0000000000000000A';
const ACTOR = { kind: 'staff', id: null, label: 'support' } as const;

interface OriginalRow {
  _id: string;
  reference: string;
  reversedByTransactionId: string | null;
}

function originalRow(overrides: Partial<OriginalRow> = {}): OriginalRow {
  return {
    _id: ORIGINAL_ID,
    reference: 'TXN-2026-000042',
    reversedByTransactionId: null,
    ...overrides,
  };
}

function originalEntries() {
  return [
    {
      _id: '01JENT0000000000000000A',
      transactionId: ORIGINAL_ID,
      accountRef: CUSTOMER,
      direction: 'debit',
      minorUnits: 7_500,
      currency: 'USD',
      sequence: 0,
    },
    {
      _id: '01JENT0000000000000000B',
      transactionId: ORIGINAL_ID,
      accountRef: CASH,
      direction: 'credit',
      minorUnits: 7_500,
      currency: 'USD',
      sequence: 1,
    },
  ];
}

/** `original: null` is how a test asks for "no such transaction", so the type must admit it. */
function setup(
  {
    original = originalRow(),
    entries = originalEntries(),
  }: { original?: OriginalRow | null; entries?: ReturnType<typeof originalEntries> } = {},
) {
  const capturedLockKeys: (readonly string[])[] = [];
  const transactionsModel = {
    create: vi.fn().mockResolvedValue([]),
    updateOne: vi.fn().mockResolvedValue({}),
    findById: vi.fn().mockReturnValue({
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(original),
    }),
  };
  const entriesModel = {
    insertMany: vi.fn().mockResolvedValue([]),
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      session: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(entries),
    }),
  };
  const balancesModel = { updateOne: vi.fn().mockResolvedValue({}), findOne: vi.fn() };
  const transactionManager = {
    withTransaction: vi.fn(
      async (
        work: (session: ClientSession) => Promise<unknown>,
        options: { lockKeys?: readonly string[] } = {},
      ) => {
        capturedLockKeys.push(options.lockKeys ?? []);
        return work(SESSION);
      },
    ),
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new LedgerService(
    transactionsModel as unknown as Model<LedgerTransactionDoc>,
    entriesModel as unknown as Model<LedgerEntryDoc>,
    balancesModel as unknown as Model<AccountBalanceDoc>,
    transactionManager as unknown as TransactionManager,
    clock,
    metricsStub(),
  );
  return { service, transactionsModel, entriesModel, balancesModel, capturedLockKeys };
}

describe('LedgerService.reverse', () => {
  it('writes the mirror image of every original line as a new transaction', async () => {
    const { service, transactionsModel, entriesModel } = setup();

    const reversal = await service.reverse(ORIGINAL_ID, 'Duplicate charge', ACTOR);

    const [entryDocs] = entriesModel.insertMany.mock.calls[0] as [Record<string, unknown>[]];
    expect(entryDocs.map((doc) => doc.direction)).toEqual(['credit', 'debit']);
    expect(entryDocs[0]).toMatchObject({
      accountRef: CUSTOMER,
      minorUnits: 7_500,
      narrative: 'Reversal of TXN-2026-000042',
      transactionType: 'reversal',
    });

    const [headerDocs] = transactionsModel.create.mock.calls[0] as [Record<string, unknown>[]];
    expect(headerDocs[0]).toMatchObject({
      type: 'reversal',
      reference: expect.stringMatching(/^REV-/),
      description: 'Reversal of TXN-2026-000042: Duplicate charge',
      reversesTransactionId: ORIGINAL_ID,
      metadata: { reason: 'Duplicate charge', originalReference: 'TXN-2026-000042' },
    });
    expect(reversal.type).toBe('reversal');
    expect(reversal.entries).toHaveLength(2);
  });

  it('marks the original reversed and points it at the mirror — nothing is deleted', async () => {
    const { service, transactionsModel } = setup();

    const reversal = await service.reverse(ORIGINAL_ID, 'Duplicate charge', ACTOR);

    expect(transactionsModel.updateOne).toHaveBeenCalledWith(
      { _id: ORIGINAL_ID },
      { $set: { status: 'reversed', reversedByTransactionId: reversal.id } },
      { session: SESSION },
    );
  });

  it('locks the balance documents the mirror will touch, deduplicated', async () => {
    const { service, capturedLockKeys } = setup();

    await service.reverse(ORIGINAL_ID, 'Duplicate charge', ACTOR);

    expect(capturedLockKeys[0]).toEqual([`balance:${CUSTOMER}:USD`, `balance:${CASH}:USD`]);
  });

  it('throws a typed not-found error for an unknown transaction', async () => {
    const { service, transactionsModel } = setup({ original: null });

    await expect(service.reverse('01JMISSING', 'reason', ACTOR)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(transactionsModel.create).not.toHaveBeenCalled();
  });

  it('refuses to reverse a transaction that has already been reversed', async () => {
    const { service, transactionsModel } = setup({
      original: originalRow({ reversedByTransactionId: '01JREV0000000000000000A' }),
    });

    await expect(service.reverse(ORIGINAL_ID, 'Again', ACTOR)).rejects.toMatchObject({
      code: 'CONFLICT',
    });
    expect(transactionsModel.create).not.toHaveBeenCalled();
  });
});

describe('LedgerService.getBalance', () => {
  it('returns the cached balance for the account and currency', async () => {
    const { service, balancesModel } = setup();
    balancesModel.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue({ ledgerMinorUnits: 4_200 }),
    });

    const balance = await service.getBalance(CUSTOMER, 'USD');

    expect(balancesModel.findOne).toHaveBeenCalledWith({ accountRef: CUSTOMER, currency: 'USD' });
    // `getBalance` returns domain Money; `scale` belongs to the wire DTO, not to this shape.
    expect(balance).toEqual({ minorUnits: 4_200, currency: 'USD' });
  });

  it('reads as zero when the account has never been posted to', async () => {
    const { service, balancesModel } = setup();
    balancesModel.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

    const balance = await service.getBalance(CUSTOMER, 'USD');

    expect(balance.minorUnits).toBe(0);
  });
});

describe('LedgerService.markSettled', () => {
  it('stamps the settlement time without a session', async () => {
    const { service, transactionsModel } = setup();
    const query = { session: vi.fn().mockResolvedValue(undefined) };
    transactionsModel.updateOne.mockReturnValue(query);

    await service.markSettled(ORIGINAL_ID);

    expect(transactionsModel.updateOne).toHaveBeenCalledWith(
      { _id: ORIGINAL_ID },
      { $set: { status: 'settled', settledAt: NOW } },
    );
    expect(query.session).not.toHaveBeenCalled();
  });

  it('joins the caller’s transaction when a session is supplied', async () => {
    const { service, transactionsModel } = setup();
    const query = { session: vi.fn().mockResolvedValue(undefined) };
    transactionsModel.updateOne.mockReturnValue(query);

    await service.markSettled(ORIGINAL_ID, SESSION);

    expect(query.session).toHaveBeenCalledWith(SESSION);
  });
});

describe('LedgerService.isInternal', () => {
  it('distinguishes GL accounts from customer accounts', () => {
    const { service } = setup();

    expect(service.isInternal(CASH)).toBe(true);
    expect(service.isInternal(CUSTOMER)).toBe(false);
  });

  it('fails loudly on a malformed reference', () => {
    const { service } = setup();

    expect(() => service.isInternal('not-a-ref')).toThrow('Malformed ledger account reference');
  });
});
