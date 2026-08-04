import type { DocumentUploadRequest, IssueLetterRequest } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ValidationError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccountsService } from '../../accounts/accounts.service.js';
import { type DocumentArchiveService } from '../document-archive.service.js';
import { DocumentsService } from '../documents.service.js';
import type { CustomerProfileReader } from '../infrastructure/customer-profile.reader.js';
import { BRANDING, CUSTOMER_ID, NOW, accountDetail, bankDocumentDoc } from './fixtures.js';

const PROFILE = { displayName: 'Ama Mensah', memberSince: '2024-01-15' };

function setup() {
  const archive = {
    branding: BRANDING,
    listForCustomer: vi.fn().mockResolvedValue([bankDocumentDoc()]),
    requireForCustomer: vi.fn().mockResolvedValue(bankDocumentDoc()),
    downloadLink: vi.fn(() => ({
      url: 'https://cdn.example/signed',
      expiresAt: '2026-08-04T10:05:00.000Z',
      filename: 'ICB-doc.pdf',
    })),
    uploadSignature: vi.fn((input: unknown) => input),
    store: vi.fn().mockResolvedValue(bankDocumentDoc({ kind: 'balance_letter' })),
  };
  const profiles = { require: vi.fn().mockResolvedValue(PROFILE) };
  const accounts = {
    getForCustomer: vi.fn().mockResolvedValue(accountDetail()),
    listForCustomer: vi.fn().mockResolvedValue([accountDetail()]),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new DocumentsService(
    archive as unknown as DocumentArchiveService,
    profiles as unknown as CustomerProfileReader,
    accounts as unknown as AccountsService,
    clock,
  );
  return { service, archive, profiles, accounts };
}

describe('DocumentsService.list', () => {
  it('maps the archived documents to the contract view', async () => {
    const { service, archive } = setup();

    const documents = await service.list(CUSTOMER_ID);

    expect(archive.listForCustomer).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(documents).toEqual([
      {
        id: 'doc-1',
        kind: 'statement',
        title: 'Statement 2026-07 for account 1234564321',
        accountId: 'acct-1',
        asset: expect.objectContaining({ publicId: 'icb/statements/acct-1/statement-a1b2' }),
        sizeBytes: 4_096,
        createdAt: NOW.toISOString(),
      },
    ]);
  });
});

describe('DocumentsService.downloadLink', () => {
  it('mints the link for the document the customer owns, named from its title', async () => {
    const { service, archive } = setup();

    const link = await service.downloadLink(CUSTOMER_ID, 'doc-1');

    expect(archive.requireForCustomer).toHaveBeenCalledWith('doc-1', CUSTOMER_ID);
    expect(archive.downloadLink).toHaveBeenCalledWith(
      expect.objectContaining({ publicId: 'icb/statements/acct-1/statement-a1b2' }),
      'ICB-statement-2026-07-for-account-1234564321.pdf',
    );
    expect(link.url).toBe('https://cdn.example/signed');
  });
});

describe('DocumentsService.uploadSignature', () => {
  it('scopes the grant to the customer folder with the request allow-list', () => {
    const { service, archive } = setup();
    const request: DocumentUploadRequest = {
      purpose: 'kyc',
      filename: 'passport.png',
      contentType: 'image/png',
      sizeBytes: 12_345,
    };

    const grant = service.uploadSignature(CUSTOMER_ID, request);

    expect(archive.uploadSignature).toHaveBeenCalledWith({
      kind: 'kyc',
      ownerId: CUSTOMER_ID,
      contentType: 'image/png',
      sizeBytes: 12_345,
      label: 'passport.png',
    });
    expect(grant).toEqual({
      kind: 'kyc',
      ownerId: CUSTOMER_ID,
      contentType: 'image/png',
      sizeBytes: 12_345,
      label: 'passport.png',
    });
  });
});

describe('DocumentsService.issueLetter — balance confirmation', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('refuses a balance confirmation that names no account', async () => {
    const request: IssueLetterRequest = { kind: 'balance_letter' };

    await expect(context.service.issueLetter(CUSTOMER_ID, request)).rejects.toThrow(ValidationError);
    expect(context.accounts.getForCustomer).not.toHaveBeenCalled();
    expect(context.archive.store).not.toHaveBeenCalled();
  });

  it('quotes the account balance and files the letter under the account', async () => {
    const request: IssueLetterRequest = { kind: 'balance_letter', accountId: 'acct-1' };

    const letter = await context.service.issueLetter(CUSTOMER_ID, request);

    expect(context.accounts.getForCustomer).toHaveBeenCalledWith('acct-1', CUSTOMER_ID);
    expect(context.archive.store).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: CUSTOMER_ID,
        kind: 'balance_letter',
        title: 'Balance confirmation',
        accountId: 'acct-1',
        ownerId: CUSTOMER_ID,
        folder: 'statements',
        filename: expect.stringMatching(/^ICB-balance-confirmation-bal-[0-9a-z]{8}\.pdf$/),
        bytes: expect.any(Buffer),
      }),
    );
    expect(letter.id).toBe('doc-1');
    expect(letter.kind).toBe('balance_letter');
  });

  it('addresses the letter to the given addressee rather than the holder', async () => {
    const request: IssueLetterRequest = {
      kind: 'balance_letter',
      accountId: 'acct-1',
      addressedTo: 'Accra Lettings Ltd',
    };

    await context.service.issueLetter(CUSTOMER_ID, request);

    const bytes = context.archive.store.mock.calls[0]?.[0].bytes as Buffer;
    expect(bytes.toString('latin1')).toContain('(To: Accra Lettings Ltd)');
  });
});

describe('DocumentsService.issueLetter — banker reference', () => {
  it('quotes the relationship length and open account count, not an account', async () => {
    const { service, archive, profiles, accounts } = setup();
    archive.store.mockResolvedValue(bankDocumentDoc({ kind: 'reference_letter', accountId: null }));

    const letter = await service.issueLetter(CUSTOMER_ID, { kind: 'reference_letter' });

    expect(profiles.require).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(accounts.listForCustomer).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(accounts.getForCustomer).not.toHaveBeenCalled();
    expect(archive.store).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'reference_letter',
        title: "Banker's reference",
        accountId: null,
        filename: expect.stringMatching(/^ICB-banker-s-reference-ref-[0-9a-z]{8}\.pdf$/),
      }),
    );
    const bytes = archive.store.mock.calls[0]?.[0].bytes as Buffer;
    const text = bytes.toString('latin1');
    expect(text).toContain('(To: To whom it may concern)');
    expect(text).toContain('(Ama Mensah has banked with International Commercial Bank since');
    expect(letter.kind).toBe('reference_letter');
  });
});
