import type { CreateTransferRequest, TransferDestination } from '@icb/contracts';
import type { ClientSession } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError, RailRejectedError } from '../../../../../common/errors/index.js';
import type { AccountDoc } from '../../../../accounts/infrastructure/account.schemas.js';
import { FxConversionService } from '../../../../fx/fx-conversion.service.js';
import type { PostingCommand } from '../../../../ledger/domain/posting.types.js';
import type { PreparedTransfer } from '../../transfer-pipeline.types.js';
import { AchTransferUseCase } from '../ach-transfer.use-case.js';
import { InternalTransferUseCase } from '../internal-transfer.use-case.js';
import { OnUsTransferUseCase } from '../on-us-transfer.use-case.js';
import { SwiftTransferUseCase } from '../swift-transfer.use-case.js';
import { WireTransferUseCase } from '../wire-transfer.use-case.js';

const NOW = new Date('2026-08-03T10:00:00.000Z');
const SETTLES = new Date('2026-08-04T10:00:00.000Z');
const session = { id: 'txn' } as unknown as ClientSession;

function account(id: string, number = '0000000001'): AccountDoc {
  return {
    _id: id,
    number,
    currency: 'GBP',
    nickname: null,
    productName: 'Current Account',
  } as unknown as AccountDoc;
}

function prepared(overrides: Partial<PreparedTransfer> = {}): PreparedTransfer {
  return {
    customerId: 'cust-1',
    transferId: 'trf-1',
    reference: 'TRF-TEST',
    destination: { kind: 'own_account', accountId: 'acct-2' },
    rail: 'internal',
    source: account('acct-1'),
    debit: { minorUnits: 10_000, currency: 'GBP' },
    credit: { minorUnits: 10_000, currency: 'GBP' },
    fx: null,
    fees: [],
    totalFees: { minorUnits: 0, currency: 'GBP' },
    recipientName: 'Savings',
    recipientMasked: '•••• 0002',
    customerReference: null,
    note: null,
    quoteId: null,
    now: NOW,
    ...overrides,
  };
}

function ledgerMock() {
  return {
    postWithin: vi.fn().mockResolvedValue({ id: 'txn-1', reference: 'TRF-TEST' }),
  };
}

function railsMock() {
  return {
    dispatch: vi.fn().mockResolvedValue({ railReference: 'TRACE-1', settlesAt: SETTLES }),
    estimate: vi.fn(),
  };
}

const fxConversion = new FxConversionService();

function postedCommand(ledger: ReturnType<typeof ledgerMock>): PostingCommand {
  return ledger.postWithin.mock.calls[0]?.[0] as PostingCommand;
}

describe('InternalTransferUseCase', () => {
  it('credits the target account directly and completes immediately', async () => {
    const ledger = ledgerMock();
    const accounts = { loadSpendable: vi.fn().mockResolvedValue(account('acct-2')) };
    const useCase = new InternalTransferUseCase(ledger as never, fxConversion, accounts as never);

    const result = await useCase.execute(prepared(), session);

    expect(result.status).toBe('completed');
    expect(result.estimatedArrival).toBe(NOW);
    expect(accounts.loadSpendable).toHaveBeenCalledWith('acct-2', 'cust-1');

    const command = postedCommand(ledger);
    expect(command.lines).toHaveLength(2);
    expect(command.lines[0]).toMatchObject({ accountRef: 'acct:acct-1', direction: 'debit' });
    expect(command.lines[1]).toMatchObject({ accountRef: 'acct:acct-2', direction: 'credit' });
    expect(command.status).toBe('posted');
  });
});

describe('OnUsTransferUseCase', () => {
  const destination: TransferDestination = { kind: 'icb_customer', accountNumber: '0011223344' };

  it('resolves the recipient by account number', async () => {
    const ledger = ledgerMock();
    const accounts = { findByNumber: vi.fn().mockResolvedValue(account('acct-9')) };
    const useCase = new OnUsTransferUseCase(ledger as never, fxConversion, accounts as never);

    const result = await useCase.execute(prepared({ destination, rail: 'on_us' }), session);

    expect(result.status).toBe('completed');
    expect(postedCommand(ledger).lines[1]).toMatchObject({ accountRef: 'acct:acct-9' });
  });

  it('throws NotFound for an unknown account number', async () => {
    const accounts = { findByNumber: vi.fn().mockResolvedValue(null) };
    const useCase = new OnUsTransferUseCase(ledgerMock() as never, fxConversion, accounts as never);

    await expect(
      useCase.execute(prepared({ destination, rail: 'on_us' }), session),
    ).rejects.toThrow(NotFoundError);
  });
});

describe('external rails', () => {
  const destination: CreateTransferRequest['destination'] = {
    kind: 'domestic_bank',
    accountNumber: '12345678',
    sortCode: '12-34-56',
    accountHolderName: 'Jane Doe',
  };
  let rails: ReturnType<typeof railsMock>;

  beforeEach(() => {
    rails = railsMock();
  });

  it('ACH parks value in pending settlement and reports the rail reference', async () => {
    const ledger = ledgerMock();
    const useCase = new AchTransferUseCase(ledger as never, fxConversion, rails);

    const result = await useCase.execute(prepared({ destination, rail: 'ach' }), session);

    expect(result.status).toBe('in_settlement');
    expect(result.estimatedArrival).toBe(SETTLES);
    expect(result.railReference).toBe('TRACE-1');
    expect(rails.dispatch).toHaveBeenCalledWith(
      'ach',
      expect.objectContaining({ creditorAccount: '12345678', sourceId: 'trf-1' }),
    );

    const command = postedCommand(ledger);
    expect(command.lines[1]).toMatchObject({ accountRef: 'gl:2100', direction: 'credit' });
    expect(command.status).toBe('authorised');
  });

  it('a rail rejection aborts before anything is posted', async () => {
    rails.dispatch.mockRejectedValue(new RailRejectedError('ach', 'R01', 'Insufficient funds'));
    const ledger = ledgerMock();
    const useCase = new AchTransferUseCase(ledger as never, fxConversion, rails);

    await expect(
      useCase.execute(prepared({ destination, rail: 'ach' }), session),
    ).rejects.toThrow(RailRejectedError);
    expect(ledger.postWithin).not.toHaveBeenCalled();
  });

  it('wire adds the fee legs to the same balanced posting', async () => {
    const ledger = ledgerMock();
    const useCase = new WireTransferUseCase(ledger as never, fxConversion, rails);
    const fee = { code: 'WIRE_FEE', label: 'Wire transfer fee', amount: { minorUnits: 2500, currency: 'GBP' as const } };

    await useCase.execute(
      prepared({ destination, rail: 'wire', fees: [fee], totalFees: fee.amount }),
      session,
    );

    const command = postedCommand(ledger);
    expect(command.lines).toHaveLength(4);
    expect(command.lines[2]).toMatchObject({
      accountRef: 'acct:acct-1',
      direction: 'debit',
      amount: { minorUnits: 2500 },
    });
    expect(command.lines[3]).toMatchObject({ accountRef: 'gl:4000', direction: 'credit' });
  });

  it('SWIFT with FX routes the conversion through the FX book, balanced per currency', async () => {
    const ledger = ledgerMock();
    const useCase = new SwiftTransferUseCase(ledger as never, fxConversion, rails);
    const fxDestination: CreateTransferRequest['destination'] = {
      kind: 'international',
      iban: 'DE89370400440532013000',
      bic: 'DEUTDEFF',
      accountHolderName: 'Mario Rossi',
      country: 'DE',
    };

    await useCase.execute(
      prepared({
        destination: fxDestination,
        rail: 'swift',
        credit: { minorUnits: 9_200, currency: 'EUR' },
        fx: { rate: 0.92, spreadBps: 50, roundingDelta: 0 },
      }),
      session,
    );

    const lines = postedCommand(ledger).lines;
    const gbp = lines.filter((line) => line.amount.currency === 'GBP');
    const eur = lines.filter((line) => line.amount.currency === 'EUR');
    expect(gbp.map((line) => line.accountRef)).toEqual(['acct:acct-1', 'gl:4200']);
    expect(eur.map((line) => line.accountRef)).toEqual(['gl:4200', 'gl:2100']);
  });
});
