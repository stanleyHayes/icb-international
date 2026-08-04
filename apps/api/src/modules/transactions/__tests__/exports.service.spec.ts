import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ForbiddenError, NotFoundError } from '../../../common/errors/index.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { LedgerEntryDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import { TransactionExportsService } from '../exports.service.js';
import type { TransactionExportDoc } from '../infrastructure/transaction-export.schemas.js';

const CUSTOMER_ID = 'cust-1';
const ACCOUNT_ID = 'acct-1';
const EXPORT_ID = 'exp-1';
const NOW = new Date('2026-08-04T10:00:00.000Z');
const FUTURE = new Date(NOW.getTime() + 300_000);

function frozenClock(): ClockService {
  const clock = new ClockService();
  clock.freeze(NOW);
  return clock;
}

function account() {
  return {
    id: ACCOUNT_ID,
    currency: 'GBP',
    productName: 'Everyday Account',
    identifiers: { number: '00112233', sortCode: '04-00-44' },
  };
}

function exportRecord(overrides: Partial<TransactionExportDoc> = {}): TransactionExportDoc {
  return {
    _id: EXPORT_ID,
    customerId: CUSTOMER_ID,
    accountId: ACCOUNT_ID,
    format: 'csv',
    from: '2026-08-01',
    to: '2026-08-31',
    linkExpiresAt: FUTURE,
    ...overrides,
  };
}

function entry(overrides: Partial<LedgerEntryDoc> = {}): LedgerEntryDoc {
  return {
    _id: 'entry-1',
    transactionId: 'txn-1',
    accountRef: `acct:${ACCOUNT_ID}`,
    direction: 'debit',
    minorUnits: 2_500,
    currency: 'GBP',
    signedMinorUnits: -2_500,
    valueDate: '2026-08-03',
    bookedAt: new Date('2026-08-03T10:00:00Z'),
    sequence: 1,
    narrative: 'Shoprite Accra',
    transactionType: 'card_payment',
    transactionStatus: 'posted',
    ...overrides,
  };
}

function setup(options: { record?: TransactionExportDoc | null; rows?: LedgerEntryDoc[] } = {}) {
  const record = options.record === undefined ? exportRecord() : options.record;
  const chain = (result: unknown) => {
    return {
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue(result),
    };
  };
  const exports = {
    findOne: vi.fn().mockReturnValue(chain(record)),
    create: vi.fn().mockImplementation(([doc]: [TransactionExportDoc]) => [doc]),
  };
  const entries = {
    find: vi.fn().mockReturnValue(chain(options.rows ?? [entry()])),
    aggregate: vi.fn().mockResolvedValue([{ total: 10_000 }]),
  };
  const accounts = { getForCustomer: vi.fn().mockResolvedValue(account()) };
  const annotations = { getForTransactions: vi.fn().mockResolvedValue(new Map()) };
  const config = {
    http: { host: '0.0.0.0', port: 4000 },
    bank: { name: 'ICB' },
  } as unknown as AppConfiguration;
  const service = new TransactionExportsService(
    exports as unknown as Model<TransactionExportDoc>,
    entries as unknown as Model<LedgerEntryDoc>,
    accounts as never,
    annotations as never,
    config,
    frozenClock(),
  );
  return { service, exports, entries, accounts, annotations, record };
}

const BODY = { accountId: ACCOUNT_ID, format: 'csv', from: '2026-08-01', to: '2026-08-31' } as never;

describe('TransactionExportsService.request', () => {
  it('mints a localhost download link against the existing record', async () => {
    const { service, exports } = setup();

    const link = await service.request(CUSTOMER_ID, BODY);

    expect(exports.create).not.toHaveBeenCalled();
    expect(link).toEqual({
      url: `http://localhost:4000/v1/transactions/exports/${EXPORT_ID}/download`,
      expiresAt: FUTURE.toISOString(),
      filename: 'transactions-00112233-2026-08-01-2026-08-31.csv',
    });
  });

  it('creates a record when the triple is new', async () => {
    const { service, exports } = setup({ record: null });
    exports.findOne.mockReturnValue({
      lean: vi.fn().mockResolvedValue(null),
    });

    await service.request(CUSTOMER_ID, BODY);
    expect(exports.create).toHaveBeenCalledWith([
      expect.objectContaining({ customerId: CUSTOMER_ID, accountId: ACCOUNT_ID, format: 'csv' }),
    ]);
  });

  it('re-reads the winner when a concurrent insert races the unique index', async () => {
    const { service, exports } = setup({ record: null });
    const duplicate = Object.assign(new Error('duplicate key'), { code: 11_000 });
    exports.create.mockRejectedValue(duplicate);
    exports.findOne
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(null) })
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue(exportRecord()) });

    const link = await service.request(CUSTOMER_ID, BODY);
    expect(link.url).toContain(EXPORT_ID);
  });

  it('rethrows a non-duplicate insert failure', async () => {
    const { service, exports } = setup({ record: null });
    exports.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    exports.create.mockRejectedValue(new Error('connection lost'));

    await expect(service.request(CUSTOMER_ID, BODY)).rejects.toThrow('connection lost');
  });

  it('rethrows when the duplicate winner cannot be re-read', async () => {
    const { service, exports } = setup({ record: null });
    const duplicate = Object.assign(new Error('duplicate key'), { code: 11_000 });
    exports.create.mockRejectedValue(duplicate);
    exports.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

    await expect(service.request(CUSTOMER_ID, BODY)).rejects.toThrow('duplicate key');
  });
});

describe('TransactionExportsService.renderDownload', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('throws NotFoundError when the export is missing or not the caller\'s', async () => {
    const { service } = setup({ record: null });
    await expect(service.renderDownload(CUSTOMER_ID, EXPORT_ID)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('refuses an expired link', async () => {
    const { service } = setup({ record: exportRecord({ linkExpiresAt: NOW }) });
    await expect(service.renderDownload(CUSTOMER_ID, EXPORT_ID)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it('renders csv from the ledger with the opening balance folded in', async () => {
    const result = await deps.service.renderDownload(CUSTOMER_ID, EXPORT_ID);

    expect(result.contentType).toBe('text/csv; charset=utf-8');
    expect(result.filename).toBe('transactions-00112233-2026-08-01-2026-08-31.csv');
    const text = result.bytes.toString('utf8');
    expect(text).toContain('Shoprite Accra');
  });

  it('defaults a missing narrative to a plain description', async () => {
    const { service } = setup({ rows: [entry({ narrative: null })] });
    const result = await service.renderDownload(CUSTOMER_ID, EXPORT_ID);
    expect(result.bytes.toString('utf8')).toContain('Transaction');
  });

  it('uses the annotation category over the categoriser', async () => {
    deps.annotations.getForTransactions.mockResolvedValue(
      new Map([['txn-1', { category: 'groceries' }]]),
    );
    const result = await deps.service.renderDownload(CUSTOMER_ID, EXPORT_ID);
    expect(result.bytes.toString('utf8')).toContain('groceries');
  });

  it('renders json with the window metadata', async () => {
    const { service } = setup({ record: exportRecord({ format: 'json' }) });
    const result = await service.renderDownload(CUSTOMER_ID, EXPORT_ID);

    expect(result.contentType).toBe('application/json');
    const parsed = JSON.parse(result.bytes.toString('utf8')) as Record<string, unknown>;
    expect(parsed['accountId']).toBe(ACCOUNT_ID);
  });

  it('renders ofx with the bank identifiers', async () => {
    const { service } = setup({ record: exportRecord({ format: 'ofx' }) });
    const result = await service.renderDownload(CUSTOMER_ID, EXPORT_ID);

    expect(result.contentType).toBe('application/x-ofx');
    expect(result.bytes.toString('latin1')).toContain('00112233');
  });

  it('renders pdf for the remaining format', async () => {
    const { service } = setup({ record: exportRecord({ format: 'pdf' }) });
    const result = await service.renderDownload(CUSTOMER_ID, EXPORT_ID);

    expect(result.contentType).toBe('application/pdf');
    expect(result.bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });

  it('treats an empty history as a zero opening balance', async () => {
    const { service, entries } = setup({ rows: [] });
    entries.aggregate.mockResolvedValue([]);

    const result = await service.renderDownload(CUSTOMER_ID, EXPORT_ID);
    expect(result.bytes.length).toBeGreaterThan(0);
  });
});
