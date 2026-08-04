import type { BulkTransferRequest } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../../common/errors/index.js';
import { BulkTransferValidationError } from '../../domain/transfer-errors.js';
import type { TransferOrchestrator } from '../transfer-orchestrator.js';
import { BulkTransfersService } from '../bulk-transfers.service.js';

const HEADER = 'kind,accountNumber,sortCode,holderName,iban,bic,country,amount,currency,reference';

function row(
  rowNumber: number,
  overrides: Partial<BulkTransferRequest['rows'][number]> = {},
): BulkTransferRequest['rows'][number] {
  return {
    rowNumber,
    destination: {
      kind: 'domestic_bank',
      accountNumber: '12345678',
      sortCode: '12-34-56',
      accountHolderName: 'Jane Doe',
    },
    amount: { minorUnits: 1_000, currency: 'GBP', scale: 2 },
    ...overrides,
  };
}

function request(overrides: Partial<BulkTransferRequest> = {}): BulkTransferRequest {
  return { fromAccountId: 'acct-1', rows: [row(1), row(2)], ...overrides };
}

function setup() {
  const initiate = vi.fn().mockImplementation((_customerId: string, req: { amount: { minorUnits: number; currency: string } }) =>
    Promise.resolve({ debitMinorUnits: req.amount.minorUnits, currency: req.amount.currency }),
  );
  const orchestrator = { initiate } as unknown as TransferOrchestrator;
  return { initiate, service: new BulkTransfersService(orchestrator) };
}

describe('BulkTransfersService.execute', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('runs every row through the orchestrator and sums the debits', async () => {
    const result = await context.service.execute('cust-1', request());

    expect(context.initiate).toHaveBeenCalledTimes(2);
    expect(result.accepted).toBe(2);
    expect(result.rejected).toBe(0);
    expect(result.failures).toEqual([]);
    expect(result.totalDebit).toEqual({ minorUnits: 2_000, currency: 'GBP', scale: 2 });
    expect(typeof result.batchId).toBe('string');
  });

  it('shares the batch source account and never saves beneficiaries', async () => {
    await context.service.execute('cust-1', request({ rows: [row(1, { reference: 'Rent' })] }));

    const [customerId, sent] = context.initiate.mock.calls[0] as [
      string,
      { fromAccountId: string; saveBeneficiary: boolean; reference?: string; schedule?: unknown },
    ];
    expect(customerId).toBe('cust-1');
    expect(sent.fromAccountId).toBe('acct-1');
    expect(sent.saveBeneficiary).toBe(false);
    expect(sent.reference).toBe('Rent');
    expect(sent.schedule).toBeUndefined();
  });

  it('maps executeAt onto a schedule starting that day', async () => {
    await context.service.execute(
      'cust-1',
      request({ rows: [row(1)], executeAt: '2026-08-10T09:30:00.000Z' }),
    );

    const [, sent] = context.initiate.mock.calls[0] as [
      string,
      { schedule?: { startsOn: string } },
    ];
    expect(sent.schedule).toEqual({ startsOn: '2026-08-10' });
  });

  it('a failed row is reported with its row number and the batch proceeds', async () => {
    context.initiate
      .mockRejectedValueOnce(new NotFoundError('Account', 'acct-9'))
      .mockResolvedValueOnce({ debitMinorUnits: 500, currency: 'GBP' });

    const result = await context.service.execute('cust-1', request());

    expect(result.accepted).toBe(1);
    expect(result.rejected).toBe(1);
    expect(result.failures).toEqual([
      { rowNumber: 1, code: 'NOT_FOUND', message: expect.any(String) as string },
    ]);
    expect(result.totalDebit.minorUnits).toBe(500);
  });

  it('masks non-domain errors as INTERNAL_ERROR with a generic message', async () => {
    context.initiate.mockRejectedValueOnce(new Error('connection reset'));

    const result = await context.service.execute('cust-1', request({ rows: [row(3)] }));

    expect(result.failures).toEqual([
      { rowNumber: 3, code: 'INTERNAL_ERROR', message: 'The payment could not be made' },
    ]);
  });

  it('falls back to the row amount when the orchestrator doc omits it', async () => {
    context.initiate.mockResolvedValue({ debitMinorUnits: null, currency: null });

    const result = await context.service.execute('cust-1', request({ rows: [row(1)] }));

    expect(result.totalDebit).toEqual({ minorUnits: 1_000, currency: 'GBP', scale: 2 });
  });

  it('an empty batch debits nothing and defaults to GBP', async () => {
    const result = await context.service.execute('cust-1', request({ rows: [] }));

    expect(context.initiate).not.toHaveBeenCalled();
    expect(result.accepted).toBe(0);
    expect(result.totalDebit).toEqual({ minorUnits: 0, currency: 'GBP', scale: 2 });
  });
});

describe('BulkTransfersService.executeCsv', () => {
  it('parses the file before a single payment runs', async () => {
    const context = setup();
    const csv = `${HEADER}\ndomestic_bank,12345678,12-34-56,Jane Doe,,,,10.00,GBP,Invoice 1`;

    const result = await context.service.executeCsv('cust-1', 'acct-1', csv);

    expect(result.accepted).toBe(1);
    const [customerId, sent] = context.initiate.mock.calls[0] as [
      string,
      {
        fromAccountId: string;
        amount: { minorUnits: number; currency: string };
        reference?: string;
      },
    ];
    expect(customerId).toBe('cust-1');
    expect(sent.fromAccountId).toBe('acct-1');
    expect(sent.amount.minorUnits).toBe(1_000);
    expect(sent.reference).toBe('Invoice 1');
  });

  it('rejects a bad header without executing anything', async () => {
    const context = setup();

    await expect(
      context.service.executeCsv('cust-1', 'acct-1', 'wrong,header\nfoo,bar'),
    ).rejects.toThrow(BulkTransferValidationError);
    expect(context.initiate).not.toHaveBeenCalled();
  });

  it('rejects the whole file when one row is malformed', async () => {
    const context = setup();
    const csv = `${HEADER}\ndomestic_bank,12345678,12-34-56,Jane Doe,,,,10.00,GBP,ok\ncheque,,,,,,,5.00,GBP,bad`;

    await expect(context.service.executeCsv('cust-1', 'acct-1', csv)).rejects.toThrow(
      BulkTransferValidationError,
    );
    expect(context.initiate).not.toHaveBeenCalled();
  });
});
