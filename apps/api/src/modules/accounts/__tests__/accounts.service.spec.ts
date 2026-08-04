import type { ClientSession, Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import {
  AccountClosedError,
  AccountFrozenError,
  ConflictError,
  NotFoundError,
} from '../../../common/errors/index.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountBalanceDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import { AccountsService, type OpenAccountCommand } from '../accounts.service.js';
import { isValidAccountNumber, isValidIban } from '../domain/account-number.js';
import type { AccountDoc } from '../infrastructure/account.schemas.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');
const SESSION = { id: 'session-1' } as unknown as ClientSession;

const CONFIG = {
  bank: {
    name: 'ICB',
    bic: 'ICBKGHAC',
    country: 'GH',
    sortCode: '04-06-75',
    baseCurrency: 'GHS',
    timezone: 'Africa/Accra',
  },
} as unknown as AppConfiguration;

function queryChain<T>(result: T) {
  return {
    session: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    lean: vi.fn().mockResolvedValue(result),
  };
}

function accountDoc(overrides: Partial<AccountDoc> = {}): AccountDoc {
  return {
    _id: 'acct-1',
    customerId: 'cust-1',
    productCode: 'CURRENT',
    productName: 'Current account',
    kind: 'current',
    number: '6016133192',
    iban: 'GH29ICBK6016133192',
    bic: 'ICBKGHAC',
    sortCode: '04-06-75',
    currency: 'GHS',
    status: 'active',
    nickname: null,
    primary: true,
    overdraftMinorUnits: 0,
    interestRate: null,
    minimumBalanceMinorUnits: null,
    monthlyFeeMinorUnits: null,
    statementDay: 1,
    lastStatementAt: null,
    openedAt: NOW,
    closedAt: null,
    closureReason: null,
    ...overrides,
  };
}

function openCommand(overrides: Partial<OpenAccountCommand> = {}): OpenAccountCommand {
  return {
    customerId: 'cust-1',
    productCode: 'CURRENT',
    productName: 'Current account',
    kind: 'current',
    currency: 'GHS',
    entropy: () => 0.42,
    ...overrides,
  };
}

function setup({
  found = null as AccountDoc | null,
  listed = [] as AccountDoc[],
  balanceRows = [] as Partial<AccountBalanceDoc>[],
  exists = null as { _id: string } | null,
  matchedCount = 1,
} = {}) {
  const accounts = {
    create: vi.fn().mockImplementation((docs: unknown[]) => Promise.resolve(docs)),
    find: vi.fn().mockReturnValue(queryChain(listed)),
    findOne: vi.fn().mockReturnValue(queryChain(found)),
    exists: vi.fn().mockResolvedValue(exists),
    updateOne: vi.fn().mockResolvedValue({ matchedCount }),
  };
  const balances = {
    find: vi.fn().mockReturnValue(queryChain(balanceRows)),
    findOne: vi.fn().mockReturnValue(queryChain(balanceRows[0] ?? null)),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new AccountsService(
    accounts as unknown as Model<AccountDoc>,
    balances as unknown as Model<AccountBalanceDoc>,
    CONFIG,
    clock,
  );
  return { service, accounts, balances };
}

describe('AccountsService.open', () => {
  it('creates the account with valid identifiers and seeds its balance row', async () => {
    const { service, accounts, balances } = setup();

    const summary = await service.open(openCommand(), SESSION);

    const [docs, options] = accounts.create.mock.calls[0] as [
      Record<string, unknown>[],
      { session: ClientSession },
    ];
    expect(options.session).toBe(SESSION);
    expect(isValidAccountNumber(String(docs[0]?.number))).toBe(true);
    expect(isValidIban(String(docs[0]?.iban))).toBe(true);
    expect(String(docs[0]?.iban)).toContain(String(docs[0]?.number));

    expect(balances.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'GHS' }),
      expect.objectContaining({ $setOnInsert: expect.objectContaining({ normalSide: 'credit' }) }),
      { upsert: true, session: SESSION },
    );
    expect(summary.status).toBe('active');
    expect(summary.openedAt).toBe(NOW.toISOString());
  });

  it('marks loan balance rows as debit-normal', async () => {
    const { service, balances } = setup();

    await service.open(openCommand({ kind: 'loan' }));

    const [, update] = balances.updateOne.mock.calls[0] as [
      unknown,
      { $setOnInsert: { normalSide: string } },
    ];
    expect(update.$setOnInsert.normalSide).toBe('debit');
  });

  it('fails when the account number cannot be allocated uniquely', async () => {
    const { service } = setup({ exists: { _id: 'other' } });

    await expect(service.open(openCommand())).rejects.toBeInstanceOf(ConflictError);
  });

  it('fails when persistence returns nothing', async () => {
    const { service, accounts } = setup();
    accounts.create.mockResolvedValue([undefined]);

    await expect(service.open(openCommand())).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('AccountsService.listForCustomer', () => {
  it('maps open accounts with their balance rows', async () => {
    const { service } = setup({
      listed: [accountDoc()],
      balanceRows: [
        {
          accountRef: 'acct:acct-1',
          currency: 'GHS',
          ledgerMinorUnits: 100_000,
          holdMinorUnits: 5_000,
          asOf: NOW,
        },
      ],
    });

    const [summary] = await service.listForCustomer('cust-1');

    expect(summary?.id).toBe('acct-1');
    expect(summary?.balances.ledger.minorUnits).toBe(100_000);
    expect(summary?.balances.holds.minorUnits).toBe(5_000);
    expect(summary?.balances.available.minorUnits).toBe(95_000);
  });

  it('defaults to zero balances when the ledger has no row yet', async () => {
    const { service } = setup({ listed: [accountDoc()] });

    const [summary] = await service.listForCustomer('cust-1');

    expect(summary?.balances.ledger.minorUnits).toBe(0);
  });
});

describe('AccountsService.getForCustomer', () => {
  it('throws NotFoundError for an unknown or foreign account', async () => {
    const { service } = setup({ found: null });

    await expect(service.getForCustomer('acct-9', 'cust-1')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('returns the detail for an owned account', async () => {
    const { service } = setup({ found: accountDoc() });

    const detail = await service.getForCustomer('acct-1', 'cust-1');

    expect(detail.customerId).toBe('cust-1');
    expect(detail.statementDay).toBe(1);
  });
});

describe('AccountsService.loadSpendable', () => {
  it('rejects a missing account', async () => {
    const { service } = setup({ found: null });

    await expect(service.loadSpendable('acct-9')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects a closed account', async () => {
    const { service } = setup({ found: accountDoc({ status: 'closed' }) });

    await expect(service.loadSpendable('acct-1')).rejects.toBeInstanceOf(AccountClosedError);
  });

  it('rejects a frozen account', async () => {
    const { service } = setup({ found: accountDoc({ status: 'frozen' }) });

    await expect(service.loadSpendable('acct-1')).rejects.toBeInstanceOf(AccountFrozenError);
  });

  it('scopes the lookup to the owner when a customer id is given', async () => {
    const { service, accounts } = setup({ found: accountDoc() });

    const account = await service.loadSpendable('acct-1', 'cust-1');

    expect(accounts.findOne).toHaveBeenCalledWith({ _id: 'acct-1', customerId: 'cust-1' });
    expect(account._id).toBe('acct-1');
  });
});

describe('AccountsService.setStatus', () => {
  it('stamps closure details when closing', async () => {
    const { service, accounts } = setup();

    await service.setStatus('acct-1', 'closed', 'Customer request');

    expect(accounts.updateOne).toHaveBeenCalledWith(
      { _id: 'acct-1' },
      { $set: { status: 'closed', closedAt: NOW, closureReason: 'Customer request' } },
    );
  });

  it('throws NotFoundError when nothing matched', async () => {
    const { service } = setup({ matchedCount: 0 });

    await expect(service.setStatus('acct-9', 'frozen', 'Fraud hold')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe('AccountsService.balancesFor', () => {
  it('derives available as ledger minus holds plus overdraft', async () => {
    const { service } = setup({
      balanceRows: [{ ledgerMinorUnits: 100_000, holdMinorUnits: 30_000, overdraftMinorUnits: 10_000 }],
    });

    const balances = await service.balancesFor('acct-1', 'GHS');

    expect(balances.ledger.minorUnits).toBe(100_000);
    expect(balances.holds.minorUnits).toBe(30_000);
    expect(balances.available.minorUnits).toBe(80_000);
  });

  it('returns zeros for an account with no balance row', async () => {
    const { service } = setup();

    const balances = await service.balancesFor('acct-1', 'GHS');

    expect(balances.available.minorUnits).toBe(0);
  });
});

describe('AccountsService.findByNumber', () => {
  it('looks up an open account by number', async () => {
    const { service, accounts } = setup({ found: accountDoc() });

    const found = await service.findByNumber('6016133192');

    expect(accounts.findOne).toHaveBeenCalledWith({
      number: '6016133192',
      status: { $ne: 'closed' },
    });
    expect(found?._id).toBe('acct-1');
  });
});
