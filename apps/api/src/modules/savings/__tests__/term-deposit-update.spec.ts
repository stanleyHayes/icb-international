import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { TermDepositDoc } from '../infrastructure/term-deposit.schemas.js';
import { TermDepositsService } from '../term-deposits.service.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');
const TODAY = '2026-08-04';

function depositDoc(overrides: Partial<TermDepositDoc> = {}): TermDepositDoc {
  return {
    _id: 'dep-1',
    customerId: 'cust-1',
    accountId: 'acct-dep-1',
    fundingAccountId: 'acct-1',
    reference: 'TD-TEST',
    principalMinorUnits: 1_000_000,
    currency: 'GBP',
    rate: 4.2,
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

function setup(row: TermDepositDoc | null = depositDoc()) {
  const model = {
    findOne: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(row) }),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const accounts = {
    loadSpendable: vi.fn().mockResolvedValue({ _id: 'acct-2', currency: 'GBP' }),
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new TermDepositsService(
    model as never,
    accounts as never,
    {} as never,
    {} as never,
    clock,
    { bank: { baseCurrency: 'GBP' } } as never,
  );
  return { model, accounts, service };
}

describe('TermDepositsService.updateMaturity', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('updates the maturity instruction on a live deposit', async () => {
    const { model, service } = context;

    const updated = await service.updateMaturity('cust-1', 'dep-1', {
      maturityInstruction: 'rollover_all',
    });

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: 'dep-1' },
      { $set: { maturityInstruction: 'rollover_all' } },
    );
    expect(updated.id).toBe('dep-1');
  });

  it('nominates a rollover account the customer owns in the deposit currency', async () => {
    const { model, accounts, service } = context;

    await service.updateMaturity('cust-1', 'dep-1', { rolloverAccountId: 'acct-2' });

    expect(accounts.loadSpendable).toHaveBeenCalledWith('acct-2', 'cust-1');
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: 'dep-1' },
      { $set: { rolloverAccountId: 'acct-2' } },
    );
  });

  it('clears the rollover account when null is sent', async () => {
    context = setup(depositDoc({ rolloverAccountId: 'acct-2' }));

    await context.service.updateMaturity('cust-1', 'dep-1', { rolloverAccountId: null });

    expect(context.model.updateOne).toHaveBeenCalledWith(
      { _id: 'dep-1' },
      { $set: { rolloverAccountId: null } },
    );
    expect(context.accounts.loadSpendable).not.toHaveBeenCalled();
  });

  it('refuses a rollover account in another currency before any write', async () => {
    const { model, accounts, service } = context;
    accounts.loadSpendable.mockResolvedValue({ _id: 'acct-3', currency: 'USD' });

    await expect(
      service.updateMaturity('cust-1', 'dep-1', { rolloverAccountId: 'acct-3' }),
    ).rejects.toThrow(expect.objectContaining({ code: 'ACCOUNT_CURRENCY_MISMATCH' }) as Error);
    expect(model.updateOne).not.toHaveBeenCalled();
  });

  it('refuses to amend a deposit that has matured', async () => {
    context = setup(depositDoc({ status: 'matured', maturesOn: TODAY }));

    await expect(
      context.service.updateMaturity('cust-1', 'dep-1', { maturityInstruction: 'rollover_all' }),
    ).rejects.toThrow(ConflictError);
    expect(context.model.updateOne).not.toHaveBeenCalled();
  });

  it('refuses to amend on the maturity date itself — the lifecycle has already run', async () => {
    context = setup(depositDoc({ maturesOn: TODAY }));

    await expect(
      context.service.updateMaturity('cust-1', 'dep-1', { maturityInstruction: 'rollover_all' }),
    ).rejects.toThrow(ConflictError);
  });

  it('throws NotFound for a deposit the customer does not own', async () => {
    context = setup(null);

    await expect(
      context.service.updateMaturity('cust-2', 'dep-1', { maturityInstruction: 'rollover_all' }),
    ).rejects.toThrow(NotFoundError);
  });
});
