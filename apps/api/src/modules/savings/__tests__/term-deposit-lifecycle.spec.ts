import { fromMinorUnits } from '@icb/money';
import type { ClientSession, Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { type TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { TermDepositDoc } from '../infrastructure/term-deposit.schemas.js';
import { TermDepositLifecycleService } from '../term-deposit-lifecycle.service.js';
import { type TermDepositPostingService } from '../term-deposit-posting.service.js';
import { type TermDepositsService } from '../term-deposits.service.js';
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
    accruedTo: '2026-01-04',
    breakQuote: null,
    rolledFromDepositId: null,
    openedAt: new Date('2026-01-04T10:00:00.000Z'),
    maturedAt: null,
    brokenAt: null,
    ...overrides,
  };
}

function setup(rows: TermDepositDoc[]) {
  const deposits = {
    find: vi.fn().mockReturnValue(chainQuery(rows)),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const termDeposits = { createDeposit: vi.fn().mockResolvedValue('dep-new') };
  const postings = {
    accrueTo: vi.fn().mockResolvedValue(2_000),
    payOut: vi.fn().mockResolvedValue(undefined),
    closeDepositAccount: vi.fn().mockResolvedValue(undefined),
  };
  const transactionManager = {
    withTransaction: vi.fn((work: (session: ClientSession) => Promise<unknown>) => work(SESSION)),
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new TermDepositLifecycleService(
    deposits as unknown as Model<TermDepositDoc>,
    termDeposits as unknown as TermDepositsService,
    postings as unknown as TermDepositPostingService,
    transactionManager as unknown as TransactionManager,
    clock,
  );
  return { service, deposits, termDeposits, postings, transactionManager };
}

describe('TermDepositLifecycleService.accrueInterest', () => {
  it("accrues every active deposit that is behind, up to the clock's today", async () => {
    const { service, deposits, postings } = setup([depositDoc(), depositDoc({ _id: 'dep-2' })]);

    const credited = await service.accrueInterest();

    expect(deposits.find).toHaveBeenCalledWith({ status: 'active', accruedTo: { $lt: TODAY } });
    expect(postings.accrueTo).toHaveBeenCalledTimes(2);
    expect(postings.accrueTo).toHaveBeenCalledWith(expect.objectContaining({ _id: 'dep-1' }), TODAY, SESSION);
    expect(credited).toBe(2);
  });

  it('caps the accrual at maturity for a deposit that matured before the run date', async () => {
    const matured = depositDoc({ maturesOn: '2026-08-01', accruedTo: '2026-07-01' });
    const { service, postings } = setup([matured]);

    const credited = await service.accrueInterest('2026-08-04');

    expect(postings.accrueTo).toHaveBeenCalledWith(matured, '2026-08-01', SESSION);
    expect(credited).toBe(1);
  });

  it('skips a deposit already accrued to the run date — replay credits nothing twice', async () => {
    const { service, postings, transactionManager } = setup([depositDoc({ accruedTo: TODAY })]);

    const credited = await service.accrueInterest(TODAY);

    expect(credited).toBe(0);
    expect(postings.accrueTo).not.toHaveBeenCalled();
    expect(transactionManager.withTransaction).not.toHaveBeenCalled();
  });

  it('does no work when no deposit is due', async () => {
    const { service, transactionManager } = setup([]);

    await expect(service.accrueInterest()).resolves.toBe(0);
    expect(transactionManager.withTransaction).not.toHaveBeenCalled();
  });
});

describe('TermDepositLifecycleService.processMaturities', () => {
  it('pays principal plus interest out and closes the contract', async () => {
    const { service, deposits, postings } = setup([depositDoc({ maturesOn: TODAY })]);

    const matured = await service.processMaturities();

    expect(deposits.find).toHaveBeenCalledWith({ status: 'active', maturesOn: { $lte: TODAY } });
    expect(postings.accrueTo).toHaveBeenCalledWith(expect.anything(), TODAY, SESSION);
    expect(postings.payOut).toHaveBeenCalledWith(expect.anything(), 'acct-1', 1_002_000, SESSION);
    expect(deposits.updateOne).toHaveBeenCalledWith(
      { _id: 'dep-1' },
      { $set: { status: 'matured', maturedAt: NOW } },
      { session: SESSION },
    );
    expect(postings.closeDepositAccount).toHaveBeenCalledWith(expect.anything(), 'Term deposit matured');
    expect(matured).toStrictEqual(['dep-1']);
  });

  it('pays out to the nominated rollover account when one exists', async () => {
    const deposit = depositDoc({ maturesOn: TODAY, rolloverAccountId: 'acct-9' });
    const { service, postings } = setup([deposit]);

    await service.processMaturities();

    expect(postings.payOut).toHaveBeenCalledWith(expect.anything(), 'acct-9', 1_002_000, SESSION);
  });

  it('re-invests the full proceeds at today’s rate card on rollover_all', async () => {
    const deposit = depositDoc({ maturesOn: TODAY, maturityInstruction: 'rollover_all' });
    const { service, termDeposits } = setup([deposit]);

    await service.processMaturities();

    expect(termDeposits.createDeposit).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 'cust-1',
        fundingAccountId: 'acct-1',
        principal: fromMinorUnits(1_002_000, 'GBP'),
        termMonths: 12,
        rate: 0.051,
        maturityInstruction: 'rollover_all',
        rolledFromDepositId: 'dep-1',
      }),
      SESSION,
    );
  });

  it('re-invests only the principal on rollover_principal', async () => {
    const deposit = depositDoc({ maturesOn: TODAY, maturityInstruction: 'rollover_principal' });
    const { service, termDeposits } = setup([deposit]);

    await service.processMaturities();

    expect(termDeposits.createDeposit).toHaveBeenCalledWith(
      expect.objectContaining({ principal: fromMinorUnits(1_000_000, 'GBP') }),
      SESSION,
    );
  });

  it('does not roll over a transfer_out deposit', async () => {
    const { service, termDeposits } = setup([depositDoc({ maturesOn: TODAY })]);

    await service.processMaturities();

    expect(termDeposits.createDeposit).not.toHaveBeenCalled();
  });

  it('leaves the proceeds in the account when no rate band qualifies any more', async () => {
    const deposit = depositDoc({
      maturesOn: TODAY,
      maturityInstruction: 'rollover_principal',
      principalMinorUnits: 100,
    });
    const { service, termDeposits } = setup([deposit]);

    const matured = await service.processMaturities();

    expect(termDeposits.createDeposit).not.toHaveBeenCalled();
    expect(matured).toStrictEqual(['dep-1']);
  });

  it('returns an empty list when nothing is due', async () => {
    const { service, transactionManager } = setup([]);

    await expect(service.processMaturities()).resolves.toStrictEqual([]);
    expect(transactionManager.withTransaction).not.toHaveBeenCalled();
  });
});
