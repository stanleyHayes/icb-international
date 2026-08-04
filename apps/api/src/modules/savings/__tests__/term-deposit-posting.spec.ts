import { fromMinorUnits } from '@icb/money';
import type { ClientSession, Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { type AccountsService } from '../../accounts/accounts.service.js';
import { type LedgerService } from '../../ledger/ledger.service.js';
import type { TermDepositDoc } from '../infrastructure/term-deposit.schemas.js';
import { TermDepositPostingService } from '../term-deposit-posting.service.js';
import { chainQuery } from './fixtures.js';

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
    rate: 0.05,
    termMonths: 12,
    openedOn: '2026-01-01',
    maturesOn: '2027-01-01',
    maturityInstruction: 'transfer_out',
    rolloverAccountId: null,
    status: 'active',
    interestPaidMinorUnits: 0,
    accruedTo: '2026-01-01',
    breakQuote: null,
    rolledFromDepositId: null,
    openedAt: new Date('2026-01-01T10:00:00.000Z'),
    maturedAt: null,
    brokenAt: null,
    ...overrides,
  };
}

function setup() {
  const deposits = {
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
    findById: vi.fn().mockReturnValue(chainQuery(depositDoc())),
  };
  const accounts = {
    open: vi.fn().mockResolvedValue({ id: 'acct-dep-1' }),
    setStatus: vi.fn().mockResolvedValue(undefined),
  };
  const ledger = { postWithin: vi.fn().mockResolvedValue({ id: 'txn-1' }) };
  const service = new TermDepositPostingService(
    deposits as unknown as Model<TermDepositDoc>,
    accounts as unknown as AccountsService,
    ledger as unknown as LedgerService,
  );
  return { service, deposits, accounts, ledger };
}

describe('TermDepositPostingService account lifecycle', () => {
  it('opens the fixed-deposit account the principal sits in', async () => {
    const { service, accounts } = setup();

    const id = await service.openDepositAccount(
      { customerId: 'cust-1', currency: 'GBP', termMonths: 12, rate: 0.05, reference: 'TD-TEST' },
      SESSION,
    );

    expect(accounts.open).toHaveBeenCalledWith(
      expect.objectContaining({
        productCode: 'TD_FIXED',
        productName: '12-month term deposit',
        kind: 'fixed_deposit',
        nickname: 'TD-TEST',
      }),
      SESSION,
    );
    expect(id).toBe('acct-dep-1');
  });

  it('posts the principal as a balanced debit/credit between customer accounts', async () => {
    const { service, ledger } = setup();

    await service.postPrincipal(
      'dep-1',
      { from: 'acct-1', to: 'acct-dep-1' },
      fromMinorUnits(1_000_000, 'GBP'),
      SESSION,
    );

    expect(ledger.postWithin).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'deposit',
        sourceType: 'term_deposit',
        sourceId: 'dep-1',
        lines: [
          expect.objectContaining({ direction: 'debit' }),
          expect.objectContaining({ direction: 'credit' }),
        ],
      }),
      SESSION,
    );
  });

  it('closes the deposit account with the settlement reason', async () => {
    const { service, accounts } = setup();

    await service.closeDepositAccount(depositDoc(), 'Term deposit matured');

    expect(accounts.setStatus).toHaveBeenCalledWith('acct-dep-1', 'closed', 'Term deposit matured');
  });
});

describe('TermDepositPostingService.accrueTo', () => {
  it('posts only the difference between interest earned and interest paid', async () => {
    const { service, deposits, ledger } = setup();

    // Ten days at 5% on 1,000,000 minor units rounds to 1,370.
    const earned = await service.accrueTo(depositDoc(), '2026-01-11', SESSION);

    expect(earned).toBe(1_370);
    expect(ledger.postWithin).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'interest', valueDate: '2026-01-11', sourceId: 'dep-1' }),
      SESSION,
    );
    expect(deposits.updateOne).toHaveBeenCalledWith(
      { _id: 'dep-1' },
      { $inc: { interestPaidMinorUnits: 1_370 }, $set: { accruedTo: '2026-01-11' } },
      { session: SESSION },
    );
  });

  it('posts nothing when the paid figure already covers what has been earned', async () => {
    const { service, deposits, ledger } = setup();
    const deposit = depositDoc({ interestPaidMinorUnits: 1_370 });

    const earned = await service.accrueTo(deposit, '2026-01-11', SESSION);

    expect(earned).toBe(1_370);
    expect(ledger.postWithin).not.toHaveBeenCalled();
    expect(deposits.updateOne).toHaveBeenCalledWith(
      { _id: 'dep-1' },
      { $set: { accruedTo: '2026-01-11' } },
      { session: SESSION },
    );
  });
});

describe('TermDepositPostingService claw-back and payout', () => {
  it('claws back forfeited interest and winds the paid total down', async () => {
    const { service, deposits, ledger } = setup();

    await service.clawBackInterest(depositDoc(), 500, SESSION);

    expect(ledger.postWithin).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'adjustment', sourceId: 'dep-1' }),
      SESSION,
    );
    expect(deposits.updateOne).toHaveBeenCalledWith(
      { _id: 'dep-1' },
      { $inc: { interestPaidMinorUnits: -500 } },
      { session: SESSION },
    );
  });

  it('posts no claw-back for a zero penalty', async () => {
    const { service, deposits, ledger } = setup();

    await service.clawBackInterest(depositDoc(), 0, SESSION);

    expect(ledger.postWithin).not.toHaveBeenCalled();
    expect(deposits.updateOne).not.toHaveBeenCalled();
  });

  it('pays proceeds out of the deposit account into the destination', async () => {
    const { service, ledger } = setup();

    await service.payOut(depositDoc(), 'acct-1', 1_002_000, SESSION);

    expect(ledger.postWithin).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'withdrawal', sourceId: 'dep-1' }),
      SESSION,
    );
  });

  it('posts no payout for a zero amount', async () => {
    const { service, ledger } = setup();

    await service.payOut(depositDoc(), 'acct-1', 0, SESSION);

    expect(ledger.postWithin).not.toHaveBeenCalled();
  });
});

describe('TermDepositPostingService.loadInSession', () => {
  it('reloads the deposit inside the caller’s session', async () => {
    const { service, deposits } = setup();

    const loaded = await service.loadInSession('dep-1', SESSION);

    expect(deposits.findById).toHaveBeenCalledWith('dep-1');
    expect(loaded?._id).toBe('dep-1');
  });
});
