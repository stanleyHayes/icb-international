import { fromMinorUnits } from '@icb/money';
import type { ClientSession, Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { customerRef, glRef } from '../domain/account-ref.js';
import { GL_CASH, GL_DEPOSITS_CURRENT } from '../domain/chart-of-accounts.js';
import type { PostingCommand } from '../domain/posting.types.js';
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
const DEPOSITS = glRef(GL_DEPOSITS_CURRENT);
const CUSTOMER = customerRef('01JACC0000000000000000A');

function setup() {
  const capturedLockKeys: (readonly string[])[] = [];
  const transactionsModel = {
    create: vi.fn().mockResolvedValue([]),
    updateOne: vi.fn().mockResolvedValue({}),
    findById: vi.fn(),
  };
  const entriesModel = { insertMany: vi.fn().mockResolvedValue([]), find: vi.fn() };
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

function depositCommand(overrides: Partial<PostingCommand> = {}): PostingCommand {
  return {
    type: 'deposit',
    description: 'Opening deposit',
    actor: { kind: 'system', id: null, label: 'seed' },
    lines: [
      { accountRef: CASH, direction: 'debit', amount: fromMinorUnits(10_000, 'USD') },
      { accountRef: CUSTOMER, direction: 'credit', amount: fromMinorUnits(10_000, 'USD') },
    ],
    ...overrides,
  };
}

describe('LedgerService.post', () => {
  it('writes the header, one entry per line, and one balance update per line', async () => {
    const { service, transactionsModel, entriesModel, balancesModel } = setup();

    const posted = await service.post(depositCommand());

    const [headerDocs, headerOptions] = transactionsModel.create.mock.calls[0] as [
      Record<string, unknown>[],
      { session: ClientSession },
    ];
    expect(headerOptions.session).toBe(SESSION);
    expect(headerDocs[0]).toMatchObject({
      reference: expect.stringMatching(/^TXN-/),
      type: 'deposit',
      status: 'posted',
      description: 'Opening deposit',
      valueDate: '2026-08-04',
      bookedAt: NOW,
      settledAt: null,
      reversesTransactionId: null,
      reversedByTransactionId: null,
      metadata: {},
    });

    const [entryDocs] = entriesModel.insertMany.mock.calls[0] as [Record<string, unknown>[]];
    expect(entryDocs).toHaveLength(2);
    expect(entryDocs[0]).toMatchObject({
      accountRef: CASH,
      direction: 'debit',
      minorUnits: 10_000,
      currency: 'USD',
      signedMinorUnits: 10_000, // debit-normal asset increased by a debit
      valueDate: '2026-08-04',
      bookedAt: NOW,
      sequence: 0,
      narrative: null,
      transactionType: 'deposit',
      transactionStatus: 'posted',
    });
    expect(entryDocs[1]).toMatchObject({
      accountRef: CUSTOMER,
      direction: 'credit',
      signedMinorUnits: 10_000, // credit-normal liability increased by a credit
      sequence: 1,
    });

    expect(balancesModel.updateOne).toHaveBeenCalledTimes(2);
    const [cashFilter, cashUpdate, cashOptions] = balancesModel.updateOne.mock.calls[0] as [
      Record<string, unknown>,
      { $inc: Record<string, number>; $set: { asOf: Date } },
      { upsert: boolean; session: ClientSession },
    ];
    expect(cashFilter).toEqual({ accountRef: CASH, currency: 'USD' });
    expect(cashUpdate.$inc).toEqual({
      ledgerMinorUnits: 10_000,
      debitMinorUnits: 10_000,
      creditMinorUnits: 0,
      entryCount: 1,
    });
    // toStrictEqual, not toBe: ClockService.now() hands back a fresh Date on every call, so the
    // frozen instant is equal by value and never by reference.
    expect(cashUpdate.$set.asOf).toStrictEqual(NOW);
    expect(cashOptions).toEqual({ upsert: true, session: SESSION });

    expect(posted).toMatchObject({
      reference: headerDocs[0]?.reference,
      type: 'deposit',
      status: 'posted',
      description: 'Opening deposit',
      bookedAt: NOW,
    });
    expect(posted.entries).toHaveLength(2);
    // Domain Money, not the wire DTO: `@icb/money`'s Money is `{ minorUnits, currency }`, and
    // `scale` is attached only at the API boundary by the mappers.
    expect(posted.entries[0]?.amount).toEqual({ minorUnits: 10_000, currency: 'USD' });
  });

  it('honours an explicit reference, value date, status, and source linkage', async () => {
    const { service, transactionsModel } = setup();

    const posted = await service.post(
      depositCommand({
        reference: 'TXN-CUSTOM-1',
        valueDate: '2026-08-01',
        status: 'authorised',
        sourceType: 'transfer',
        sourceId: '01JTRF0000000000000000A',
        correlationId: 'corr-1',
        metadata: { rail: 'ach' },
      }),
    );

    expect(transactionsModel.create.mock.calls[0]?.[0]).toMatchObject([
      {
        reference: 'TXN-CUSTOM-1',
        status: 'authorised',
        valueDate: '2026-08-01',
        sourceType: 'transfer',
        sourceId: '01JTRF0000000000000000A',
        correlationId: 'corr-1',
        metadata: { rail: 'ach' },
      },
    ]);
    expect(posted.reference).toBe('TXN-CUSTOM-1');
    expect(posted.status).toBe('authorised');
  });

  it('serialises on one lock key per touched balance document, deduplicated', async () => {
    const { service, capturedLockKeys } = setup();

    await service.post(depositCommand());

    expect(capturedLockKeys[0]).toEqual([
      `balance:${CASH}:USD`,
      `balance:${CUSTOMER}:USD`,
    ]);
  });

  it('signs a debit against a credit-normal GL account as a decrease', async () => {
    const { service, entriesModel, balancesModel } = setup();

    await service.post(
      depositCommand({
        lines: [
          { accountRef: DEPOSITS, direction: 'debit', amount: fromMinorUnits(5_000, 'USD') },
          { accountRef: CASH, direction: 'credit', amount: fromMinorUnits(5_000, 'USD') },
        ],
      }),
    );

    const [entryDocs] = entriesModel.insertMany.mock.calls[0] as [Record<string, unknown>[]];
    expect(entryDocs[0]?.signedMinorUnits).toBe(-5_000);
    expect(entryDocs[1]?.signedMinorUnits).toBe(-5_000);
    const [, depositsUpdate] = balancesModel.updateOne.mock.calls[0] as [
      unknown,
      { $inc: Record<string, number> },
    ];
    expect(depositsUpdate.$inc.ledgerMinorUnits).toBe(-5_000);
  });

  it('lets a line override the value date, narrative, and normal side', async () => {
    const { service, entriesModel } = setup();

    await service.post(
      depositCommand({
        lines: [
          { accountRef: CASH, direction: 'debit', amount: fromMinorUnits(10_000, 'USD') },
          {
            accountRef: CUSTOMER,
            direction: 'credit',
            amount: fromMinorUnits(10_000, 'USD'),
            normalSide: 'debit', // e.g. a loan account, which increases on the debit side
            valueDate: '2026-07-31',
            narrative: 'Loan drawdown',
          },
        ],
      }),
    );

    const [entryDocs] = entriesModel.insertMany.mock.calls[0] as [Record<string, unknown>[]];
    expect(entryDocs[1]).toMatchObject({
      signedMinorUnits: -10_000,
      valueDate: '2026-07-31',
      narrative: 'Loan drawdown',
    });
  });

  it('balances cross-currency transactions within each currency, not across them', async () => {
    const { service, entriesModel } = setup();

    await service.post(
      depositCommand({
        type: 'fx_conversion',
        lines: [
          { accountRef: CASH, direction: 'debit', amount: fromMinorUnits(10_000, 'USD') },
          { accountRef: CUSTOMER, direction: 'credit', amount: fromMinorUnits(10_000, 'USD') },
          { accountRef: CUSTOMER, direction: 'debit', amount: fromMinorUnits(9_200, 'EUR') },
          { accountRef: CASH, direction: 'credit', amount: fromMinorUnits(9_200, 'EUR') },
        ],
      }),
    );

    const [entryDocs] = entriesModel.insertMany.mock.calls[0] as [Record<string, unknown>[]];
    expect(entryDocs).toHaveLength(4);
    expect(entryDocs.map((doc) => doc.currency)).toEqual(['USD', 'USD', 'EUR', 'EUR']);
  });

  it('refuses an unbalanced transaction before anything is written', async () => {
    const { service, transactionsModel, entriesModel, balancesModel } = setup();

    await expect(
      service.post(
        depositCommand({
          lines: [
            { accountRef: CASH, direction: 'debit', amount: fromMinorUnits(10_000, 'USD') },
            { accountRef: CUSTOMER, direction: 'credit', amount: fromMinorUnits(9_999, 'USD') },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: 'LEDGER_UNBALANCED' });

    expect(transactionsModel.create).not.toHaveBeenCalled();
    expect(entriesModel.insertMany).not.toHaveBeenCalled();
    expect(balancesModel.updateOne).not.toHaveBeenCalled();
  });

  it('refuses a transaction with fewer than two lines', async () => {
    const { service } = setup();

    await expect(
      service.post(
        depositCommand({
          lines: [
            { accountRef: CASH, direction: 'debit', amount: fromMinorUnits(10_000, 'USD') },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: 'LEDGER_UNBALANCED' });
  });

  it.each([0, -500])('refuses a non-positive amount of %i minor units', async (minorUnits) => {
    const { service, transactionsModel } = setup();

    await expect(
      service.post(
        depositCommand({
          lines: [
            { accountRef: CASH, direction: 'debit', amount: fromMinorUnits(minorUnits, 'USD') },
            { accountRef: CUSTOMER, direction: 'credit', amount: fromMinorUnits(minorUnits, 'USD') },
          ],
        }),
      ),
    ).rejects.toMatchObject({ code: 'LEDGER_UNBALANCED' });
    expect(transactionsModel.create).not.toHaveBeenCalled();
  });
});
