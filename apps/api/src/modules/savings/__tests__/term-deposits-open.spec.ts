import type { OpenTermDepositRequest } from '@icb/contracts';
import { fromMinorUnits } from '@icb/money';
import type { ClientSession, Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import {
  InsufficientFundsError,
  ValidationError,
} from '../../../common/errors/index.js';
import { type TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { type AccountsService } from '../../accounts/accounts.service.js';
import type { TermDepositDoc } from '../infrastructure/term-deposit.schemas.js';
import { type TermDepositPostingService } from '../term-deposit-posting.service.js';
import { TermDepositsService } from '../term-deposits.service.js';
import { chainQuery } from './fixtures.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');
const TODAY = '2026-08-04';
const SESSION = { name: 'unit-test-session' } as unknown as ClientSession;

function depositDoc(overrides: Partial<TermDepositDoc> = {}): TermDepositDoc {
  return {
    _id: 'dep-1',
    customerId: 'cust-1',
    accountId: 'acct-dep-1',
    fundingAccountId: 'acct-1',
    reference: 'TD-TEST',
    principalMinorUnits: 1_000_000,
    currency: 'GBP',
    rate: 0.051,
    termMonths: 12,
    openedOn: '2026-01-04',
    maturesOn: '2027-01-04',
    maturityInstruction: 'transfer_out',
    rolloverAccountId: null,
    status: 'active',
    interestPaidMinorUnits: 0,
    accruedTo: TODAY,
    breakQuote: null,
    rolledFromDepositId: null,
    openedAt: new Date('2026-01-04T10:00:00.000Z'),
    maturedAt: null,
    brokenAt: null,
    ...overrides,
  };
}

function openRequest(overrides: Partial<OpenTermDepositRequest> = {}): OpenTermDepositRequest {
  return {
    fromAccountId: 'acct-1',
    principal: { minorUnits: 1_000_000, currency: 'GBP', scale: 2 },
    termMonths: 12,
    maturityInstruction: 'transfer_out',
    ...overrides,
  };
}

function setup() {
  const deposits = {
    find: vi.fn().mockReturnValue(chainQuery([])),
    findOne: vi.fn().mockReturnValue(chainQuery(depositDoc())),
    create: vi.fn().mockResolvedValue([]),
  };
  const accounts = {
    loadSpendable: vi.fn().mockResolvedValue({ _id: 'acct-1', currency: 'GBP' }),
    balancesFor: vi.fn().mockResolvedValue({ available: fromMinorUnits(2_000_000, 'GBP') }),
  };
  const postings = {
    openDepositAccount: vi.fn().mockResolvedValue('acct-dep-new'),
    postPrincipal: vi.fn().mockResolvedValue(undefined),
  };
  const transactionManager = {
    withTransaction: vi.fn((work: (session: ClientSession) => Promise<unknown>) => work(SESSION)),
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new TermDepositsService(
    deposits as unknown as Model<TermDepositDoc>,
    accounts as unknown as AccountsService,
    postings as unknown as TermDepositPostingService,
    transactionManager as unknown as TransactionManager,
    clock,
    { bank: { baseCurrency: 'GBP' } } as never,
  );
  return { service, deposits, accounts, postings, transactionManager };
}

describe('TermDepositsService.rateCard', () => {
  it('defaults to the bank’s base currency', () => {
    const { service } = setup();

    const bands = service.rateCard();

    expect(bands).toHaveLength(21);
    expect(bands[0]?.minimumAmount.currency).toBe('GBP');
  });

  it('serves the card in an explicitly requested currency', () => {
    const { service } = setup();

    const bands = service.rateCard('JPY');

    expect(bands[0]?.minimumAmount).toStrictEqual({ minorUnits: 500, currency: 'JPY', scale: 0 });
  });

  it('rejects a currency the bank does not deal in', () => {
    const { service } = setup();

    expect(() => service.rateCard('XXX')).toThrow(ValidationError);
  });
});

describe('TermDepositsService.open', () => {
  it('prices from the rate card, moves the principal and writes the contract in one transaction', async () => {
    const { service, deposits, postings } = setup();

    const opened = await service.open('cust-1', openRequest());

    expect(postings.openDepositAccount).toHaveBeenCalledWith(
      expect.objectContaining({ customerId: 'cust-1', currency: 'GBP', termMonths: 12, rate: 0.051 }),
      SESSION,
    );
    expect(postings.postPrincipal).toHaveBeenCalledWith(
      expect.any(String),
      { from: 'acct-1', to: 'acct-dep-new' },
      expect.objectContaining({ minorUnits: 1_000_000 }),
      SESSION,
    );
    expect(deposits.create).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          customerId: 'cust-1',
          accountId: 'acct-dep-new',
          principalMinorUnits: 1_000_000,
          openedOn: TODAY,
          maturesOn: '2027-08-04',
          status: 'active',
        }),
      ],
      { session: SESSION, ordered: true },
    );
    expect(opened.id).toBe('dep-1');
  });

  it('refuses a request denominated in another currency than the funding account', async () => {
    const { service, accounts, transactionManager } = setup();

    await expect(
      service.open('cust-1', openRequest({ principal: { minorUnits: 100_000, currency: 'USD', scale: 2 } })),
    ).rejects.toThrow(expect.objectContaining({ code: 'ACCOUNT_CURRENCY_MISMATCH' }) as Error);
    expect(accounts.balancesFor).not.toHaveBeenCalled();
    expect(transactionManager.withTransaction).not.toHaveBeenCalled();
  });

  it('refuses when the funding account cannot cover the principal', async () => {
    const { service, accounts, transactionManager } = setup();
    accounts.balancesFor.mockResolvedValue({ available: fromMinorUnits(999_999, 'GBP') });

    await expect(service.open('cust-1', openRequest())).rejects.toBeInstanceOf(
      InsufficientFundsError,
    );
    expect(transactionManager.withTransaction).not.toHaveBeenCalled();
  });

  it('refuses an amount and term that qualify for no band', async () => {
    const { service, transactionManager } = setup();

    await expect(
      service.open('cust-1', openRequest({ principal: { minorUnits: 10_000, currency: 'GBP', scale: 2 } })),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(transactionManager.withTransaction).not.toHaveBeenCalled();
  });

  it('validates a nominated rollover account and stores its id on the contract', async () => {
    const { service, deposits, accounts } = setup();
    accounts.loadSpendable.mockImplementation((id: string) =>
      Promise.resolve({ _id: id, currency: 'GBP' }),
    );

    await service.open('cust-1', openRequest({ rolloverAccountId: 'acct-9' }));

    expect(accounts.loadSpendable).toHaveBeenCalledWith('acct-9', 'cust-1');
    expect(deposits.create).toHaveBeenCalledWith(
      [expect.objectContaining({ rolloverAccountId: 'acct-9' })],
      expect.anything(),
    );
  });

  it('rejects a rollover account in another currency before any write', async () => {
    const { service, deposits, accounts } = setup();
    accounts.loadSpendable.mockImplementation((id: string) =>
      Promise.resolve({ _id: id, currency: id === 'acct-9' ? 'USD' : 'GBP' }),
    );

    await expect(service.open('cust-1', openRequest({ rolloverAccountId: 'acct-9' }))).rejects.toThrow(
      expect.objectContaining({ code: 'ACCOUNT_CURRENCY_MISMATCH' }) as Error,
    );
    expect(deposits.create).not.toHaveBeenCalled();
  });
});

describe('TermDepositsService.list', () => {
  it('returns the customer’s deposits newest first', async () => {
    const { service, deposits } = setup();
    deposits.find.mockReturnValue(chainQuery([depositDoc(), depositDoc({ _id: 'dep-2' })]));

    const list = await service.list('cust-1');

    expect(deposits.find).toHaveBeenCalledWith({ customerId: 'cust-1' });
    expect(list.map((deposit) => deposit.id)).toStrictEqual(['dep-1', 'dep-2']);
  });

  it('returns an empty list when the customer has none', async () => {
    const { service } = setup();

    await expect(service.list('cust-1')).resolves.toStrictEqual([]);
  });
});
