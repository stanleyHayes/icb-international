import type { ClientSession, Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError } from '../../../common/errors/index.js';
import { type TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { BreakQuoteRecord, TermDepositDoc } from '../infrastructure/term-deposit.schemas.js';
import { TermDepositBreakService } from '../term-deposit-break.service.js';
import { type TermDepositPostingService } from '../term-deposit-posting.service.js';
import { type TermDepositsService } from '../term-deposits.service.js';

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
    rate: 0.042,
    termMonths: 12,
    openedOn: '2026-01-04',
    maturesOn: '2027-01-04',
    maturityInstruction: 'transfer_out',
    rolloverAccountId: null,
    status: 'active',
    interestPaidMinorUnits: 0,
    accruedTo: '2026-01-04',
    breakQuote: null,
    rolledFromDepositId: null,
    openedAt: new Date('2026-01-04T10:00:00.000Z'),
    maturedAt: null,
    brokenAt: null,
    ...overrides,
  };
}

function liveQuote(overrides: Partial<BreakQuoteRecord> = {}): BreakQuoteRecord {
  return {
    accruedInterestMinorUnits: 1_000,
    penaltyMinorUnits: 1_000,
    netProceedsMinorUnits: 1_000_000,
    interestForfeitedMinorUnits: 50_000,
    quotedOn: TODAY,
    expiresAt: new Date(NOW.getTime() + 15 * 60 * 1000),
    ...overrides,
  };
}

function setup(deposit: TermDepositDoc) {
  const deposits = { updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }) };
  const termDeposits = {
    loadDeposit: vi.fn().mockResolvedValue(deposit),
    get: vi.fn().mockResolvedValue({ id: deposit._id }),
  };
  const postings = {
    loadInSession: vi.fn().mockResolvedValue(null),
    accrueTo: vi.fn().mockResolvedValue(0),
    clawBackInterest: vi.fn().mockResolvedValue(undefined),
    payOut: vi.fn().mockResolvedValue(undefined),
    closeDepositAccount: vi.fn().mockResolvedValue(undefined),
  };
  const transactionManager = {
    withTransaction: vi.fn((work: (session: ClientSession) => Promise<unknown>) => work(SESSION)),
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new TermDepositBreakService(
    deposits as unknown as Model<TermDepositDoc>,
    termDeposits as unknown as TermDepositsService,
    postings as unknown as TermDepositPostingService,
    transactionManager as unknown as TransactionManager,
    clock,
  );
  return { service, deposits, termDeposits, postings, transactionManager };
}

describe('TermDepositBreakService.quote', () => {
  it('persists the quoted figures and returns them with a fifteen-minute expiry', async () => {
    const { service, deposits } = setup(depositDoc());

    const quote = await service.quote('cust-1', 'dep-1');

    const expiry = new Date(NOW.getTime() + 15 * 60 * 1000);
    expect(deposits.updateOne).toHaveBeenCalledWith(
      { _id: 'dep-1' },
      {
        $set: {
          breakQuote: expect.objectContaining({ quotedOn: TODAY, expiresAt: expiry }),
        },
      },
    );
    expect(quote.depositId).toBe('dep-1');
    expect(quote.validUntil).toBe(expiry.toISOString());
  });

  it('refuses to quote a deposit that is not active', async () => {
    const { service, deposits } = setup(depositDoc({ status: 'matured' }));

    await expect(service.quote('cust-1', 'dep-1')).rejects.toBeInstanceOf(ConflictError);
    expect(deposits.updateOne).not.toHaveBeenCalled();
  });
});

describe('TermDepositBreakService.execute', () => {
  it('accrues, claws back, pays out and closes the contract against the stored quote', async () => {
    const deposit = depositDoc({ breakQuote: liveQuote() });
    const { service, deposits, postings, termDeposits } = setup(deposit);

    const result = await service.execute('cust-1', 'dep-1');

    expect(postings.accrueTo).toHaveBeenCalledWith(deposit, TODAY, SESSION);
    expect(postings.clawBackInterest).toHaveBeenCalledWith(deposit, 1_000, SESSION);
    expect(postings.payOut).toHaveBeenCalledWith(deposit, 'acct-1', 1_000_000, SESSION);
    expect(deposits.updateOne).toHaveBeenCalledWith(
      { _id: 'dep-1' },
      { $set: { status: 'broken', brokenAt: NOW, breakQuote: null } },
      { session: SESSION },
    );
    expect(postings.closeDepositAccount).toHaveBeenCalledWith(deposit, 'Term deposit broken early');
    expect(termDeposits.get).toHaveBeenCalledWith('cust-1', 'dep-1');
    expect(result).toStrictEqual({ id: 'dep-1' });
  });

  it('uses the in-session reload and its rollover account when present', async () => {
    const deposit = depositDoc({ breakQuote: liveQuote() });
    const reloaded = depositDoc({ breakQuote: liveQuote(), rolloverAccountId: 'acct-9' });
    const { service, postings } = setup(deposit);
    postings.loadInSession.mockResolvedValue(reloaded);

    await service.execute('cust-1', 'dep-1');

    expect(postings.loadInSession).toHaveBeenCalledWith('dep-1', SESSION);
    expect(postings.accrueTo).toHaveBeenCalledWith(reloaded, TODAY, SESSION);
    expect(postings.payOut).toHaveBeenCalledWith(reloaded, 'acct-9', 1_000_000, SESSION);
  });

  it('refuses to execute without a quote', async () => {
    const { service, transactionManager } = setup(depositDoc());

    await expect(service.execute('cust-1', 'dep-1')).rejects.toBeInstanceOf(ConflictError);
    expect(transactionManager.withTransaction).not.toHaveBeenCalled();
  });

  it('refuses a quote priced on a different day', async () => {
    const deposit = depositDoc({ breakQuote: liveQuote({ quotedOn: '2026-08-03' }) });
    const { service, transactionManager } = setup(deposit);

    await expect(service.execute('cust-1', 'dep-1')).rejects.toBeInstanceOf(ConflictError);
    expect(transactionManager.withTransaction).not.toHaveBeenCalled();
  });

  it('refuses a quote whose fifteen minutes have run out', async () => {
    const deposit = depositDoc({
      breakQuote: liveQuote({ expiresAt: new Date(NOW.getTime() - 1) }),
    });
    const { service, transactionManager } = setup(deposit);

    await expect(service.execute('cust-1', 'dep-1')).rejects.toBeInstanceOf(ConflictError);
    expect(transactionManager.withTransaction).not.toHaveBeenCalled();
  });

  it('refuses to break a deposit that is not active', async () => {
    const deposit = depositDoc({ status: 'broken', breakQuote: liveQuote() });
    const { service, transactionManager } = setup(deposit);

    await expect(service.execute('cust-1', 'dep-1')).rejects.toBeInstanceOf(ConflictError);
    expect(transactionManager.withTransaction).not.toHaveBeenCalled();
  });
});
