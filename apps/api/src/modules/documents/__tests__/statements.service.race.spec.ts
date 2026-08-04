import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError } from '../../../common/errors/index.js';
import { DUPLICATE_KEY_CODE } from '../../../infrastructure/database/database.constants.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountsService } from '../../accounts/accounts.service.js';
import type { DocumentArchiveService } from '../document-archive.service.js';
import type { CustomerProfileReader } from '../infrastructure/customer-profile.reader.js';
import type { StatementDoc } from '../infrastructure/document.schemas.js';
import type { StatementLedgerReader } from '../infrastructure/statement-ledger.reader.js';
import { StatementsService } from '../statements.service.js';
import {
  ACCOUNT_ID,
  BRANDING,
  CUSTOMER_ID,
  NOW,
  accountDetail,
  bankDocumentDoc,
  leanOf,
  statementDoc,
} from './fixtures.js';

const REQUEST = { accountId: ACCOUNT_ID, from: '2026-07-01', to: '2026-07-31' };

function setup() {
  const statements = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
  };
  const ledger = {
    normalSideFor: vi.fn().mockResolvedValue('credit'),
    totalsBefore: vi.fn().mockResolvedValue({
      creditMinorUnits: 500_000,
      debitMinorUnits: 0,
      signedMinorUnits: 500_000,
      count: 5,
    }),
    totalsWithin: vi.fn().mockResolvedValue({
      creditMinorUnits: 20_000,
      debitMinorUnits: 5_000,
      signedMinorUnits: 15_000,
      count: 2,
    }),
    linesWithin: vi.fn().mockResolvedValue([]),
  };
  const accounts = { getForCustomer: vi.fn().mockResolvedValue(accountDetail()) };
  const archive = {
    branding: BRANDING,
    store: vi.fn().mockResolvedValue(bankDocumentDoc()),
    discard: vi.fn().mockResolvedValue(undefined),
    downloadLink: vi.fn(),
  };
  const profiles = {
    require: vi.fn().mockResolvedValue({ displayName: 'Ama Mensah', memberSince: '2024-01-15' }),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new StatementsService(
    statements as unknown as Model<StatementDoc>,
    ledger as unknown as StatementLedgerReader,
    accounts as unknown as AccountsService,
    archive as unknown as DocumentArchiveService,
    profiles as unknown as CustomerProfileReader,
    clock,
  );
  return { service, statements, archive };
}

describe('StatementsService publish race', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('discards the losing upload and returns the statement that won the race', async () => {
    context.statements.findOne
      .mockReturnValueOnce(leanOf(null))
      .mockReturnValue(leanOf(statementDoc()));
    context.statements.create.mockRejectedValue({ code: DUPLICATE_KEY_CODE });

    const statement = await context.service.generate(CUSTOMER_ID, REQUEST);

    expect(context.archive.discard).toHaveBeenCalledWith(expect.objectContaining({ _id: 'doc-1' }));
    expect(context.statements.findOne).toHaveBeenCalledTimes(2);
    expect(statement.id).toBe('stmt-1');
  });

  it('keeps the uploaded asset and rethrows when the write failed for another reason', async () => {
    context.statements.findOne.mockReturnValue(leanOf(null));
    context.statements.create.mockRejectedValue(new Error('connection reset'));

    await expect(context.service.generate(CUSTOMER_ID, REQUEST)).rejects.toThrow('connection reset');
    expect(context.archive.discard).not.toHaveBeenCalled();
  });

  it('raises a conflict when the unique index rejected the write but no winner exists', async () => {
    context.statements.findOne.mockReturnValue(leanOf(null));
    context.statements.create.mockRejectedValue({ code: DUPLICATE_KEY_CODE });

    await expect(context.service.generate(CUSTOMER_ID, REQUEST)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(context.archive.discard).toHaveBeenCalled();
  });

  it('raises a conflict when the insert returns no row', async () => {
    context.statements.findOne.mockReturnValue(leanOf(null));
    context.statements.create.mockResolvedValue([]);

    await expect(context.service.generate(CUSTOMER_ID, REQUEST)).rejects.toBeInstanceOf(
      ConflictError,
    );
    expect(context.archive.discard).not.toHaveBeenCalled();
  });
});
