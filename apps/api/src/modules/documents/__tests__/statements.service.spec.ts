import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError, ValidationError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountsService } from '../../accounts/accounts.service.js';
import { type DocumentArchiveService } from '../document-archive.service.js';
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

export function setup() {
  const statements = {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn().mockResolvedValue([statementDoc()]),
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
    linesWithin: vi.fn().mockResolvedValue([
      { valueDate: '2026-07-03', description: 'Salary', direction: 'credit', minorUnits: 20_000 },
      { valueDate: '2026-07-10', description: 'Rent', direction: 'debit', minorUnits: 5_000 },
    ]),
  };
  const accounts = { getForCustomer: vi.fn().mockResolvedValue(accountDetail()) };
  const archive = {
    branding: BRANDING,
    store: vi.fn().mockResolvedValue(bankDocumentDoc()),
    discard: vi.fn().mockResolvedValue(undefined),
    downloadLink: vi.fn(() => ({
      url: 'https://cdn.example/signed',
      expiresAt: '2026-08-04T10:05:00.000Z',
      filename: 'ICB-statement.pdf',
    })),
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
  return { service, statements, ledger, accounts, archive, profiles };
}

describe('StatementsService.listForCustomer', () => {
  it('lists the customer statements newest first, mapped to the contract view', async () => {
    const { service, statements } = setup();
    const sort = vi.fn(() => leanOf([statementDoc()]));
    statements.find.mockReturnValue({ sort });

    const listed = await service.listForCustomer(CUSTOMER_ID);

    expect(statements.find).toHaveBeenCalledWith({ customerId: CUSTOMER_ID });
    expect(sort).toHaveBeenCalledWith({ generatedAt: -1, _id: -1 });
    expect(listed).toEqual([
      {
        id: 'stmt-1',
        accountId: ACCOUNT_ID,
        accountLabel: 'Everyday Current ····4321',
        period: '2026-07',
        from: '2026-07-01',
        to: '2026-07-31',
        openingBalance: { minorUnits: 500_000, currency: 'GBP', scale: 2 },
        closingBalance: { minorUnits: 515_000, currency: 'GBP', scale: 2 },
        totalCredits: { minorUnits: 20_000, currency: 'GBP', scale: 2 },
        totalDebits: { minorUnits: 5_000, currency: 'GBP', scale: 2 },
        transactionCount: 2,
        asset: expect.objectContaining({ publicId: 'icb/statements/acct-1/statement-a1b2' }),
        generatedAt: NOW.toISOString(),
      },
    ]);
  });
});

describe('StatementsService.downloadLink', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('mints a link for the rendered asset, named after the account and period', async () => {
    context.statements.findOne.mockReturnValue(leanOf(statementDoc()));

    const link = await context.service.downloadLink(CUSTOMER_ID, 'stmt-1');

    expect(context.statements.findOne).toHaveBeenCalledWith({ _id: 'stmt-1', customerId: CUSTOMER_ID });
    expect(context.archive.downloadLink).toHaveBeenCalledWith(
      expect.objectContaining({ publicId: 'icb/statements/acct-1/statement-a1b2' }),
      'ICB-statement-everyday-current-4321-2026-07.pdf',
    );
    expect(link.url).toBe('https://cdn.example/signed');
  });

  it('raises a typed not-found for a statement the customer cannot name', async () => {
    context.statements.findOne.mockReturnValue(leanOf(null));

    await expect(context.service.downloadLink(CUSTOMER_ID, 'stmt-9')).rejects.toThrow(NotFoundError);
  });

  it('refuses when the statement was recorded without a rendered document', async () => {
    context.statements.findOne.mockReturnValue(leanOf(statementDoc({ asset: null })));

    await expect(context.service.downloadLink(CUSTOMER_ID, 'stmt-1')).rejects.toThrow(ConflictError);
    expect(context.archive.downloadLink).not.toHaveBeenCalled();
  });
});

describe('StatementsService.generate', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('rejects a window that ends before it starts', async () => {
    await expect(
      context.service.generate(CUSTOMER_ID, {
        accountId: ACCOUNT_ID,
        from: '2026-08-01',
        to: '2026-07-01',
      }),
    ).rejects.toThrow(ValidationError);
    expect(context.statements.findOne).not.toHaveBeenCalled();
  });

  it('rejects a window that runs past the business date', async () => {
    await expect(
      context.service.generate(CUSTOMER_ID, {
        accountId: ACCOUNT_ID,
        from: '2026-08-01',
        to: '2026-08-05',
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('returns the statement already issued for the exact window instead of re-rendering', async () => {
    context.statements.findOne.mockReturnValue(leanOf(statementDoc()));

    const statement = await context.service.generate(CUSTOMER_ID, {
      accountId: ACCOUNT_ID,
      from: '2026-07-01',
      to: '2026-07-31',
    });

    expect(context.statements.findOne).toHaveBeenCalledWith({
      customerId: CUSTOMER_ID,
      accountId: ACCOUNT_ID,
      from: '2026-07-01',
      to: '2026-07-31',
    });
    expect(context.accounts.getForCustomer).not.toHaveBeenCalled();
    expect(context.archive.store).not.toHaveBeenCalled();
    expect(statement.id).toBe('stmt-1');
  });
});

describe('StatementsService.generateForMonth', () => {
  it('issues the calendar month containing the date, reconciled and recorded', async () => {
    const { service, statements, ledger, accounts, archive, profiles } = setup();
    statements.findOne.mockReturnValue(leanOf(null));

    const statement = await service.generateForMonth(CUSTOMER_ID, ACCOUNT_ID, '2026-07-20');

    expect(statements.findOne).toHaveBeenCalledWith({
      customerId: CUSTOMER_ID,
      accountId: ACCOUNT_ID,
      from: '2026-07-01',
      to: '2026-07-31',
    });
    expect(accounts.getForCustomer).toHaveBeenCalledWith(ACCOUNT_ID, CUSTOMER_ID);
    expect(profiles.require).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(ledger.normalSideFor).toHaveBeenCalledWith('acct:acct-1', 'GBP');
    expect(ledger.totalsBefore).toHaveBeenCalledWith('acct:acct-1', 'GBP', '2026-07-01');
    expect(ledger.totalsWithin).toHaveBeenCalledWith('acct:acct-1', 'GBP', '2026-07-01', '2026-07-31');
    expect(ledger.linesWithin).toHaveBeenCalledWith('acct:acct-1', 'GBP', '2026-07-01', '2026-07-31');

    expect(archive.store).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: CUSTOMER_ID,
        kind: 'statement',
        title: 'Statement 2026-07 for account 1234564321',
        accountId: ACCOUNT_ID,
        ownerId: ACCOUNT_ID,
        folder: 'statements',
        filename: 'ICB-statement-1234564321-2026-07.pdf',
        bytes: expect.any(Buffer),
      }),
    );
    expect(statements.create).toHaveBeenCalledWith([
      expect.objectContaining({
        customerId: CUSTOMER_ID,
        accountId: ACCOUNT_ID,
        accountLabel: 'Everyday Current ····4321',
        period: '2026-07',
        from: '2026-07-01',
        to: '2026-07-31',
        currency: 'GBP',
        openingMinorUnits: 500_000,
        closingMinorUnits: 515_000,
        totalCreditsMinorUnits: 20_000,
        totalDebitsMinorUnits: 5_000,
        transactionCount: 2,
        documentId: 'doc-1',
        generatedAt: NOW,
      }),
    ]);
    expect(statement).toEqual(
      expect.objectContaining({
        id: 'stmt-1',
        period: '2026-07',
        generatedAt: NOW.toISOString(),
      }),
    );
  });
});
