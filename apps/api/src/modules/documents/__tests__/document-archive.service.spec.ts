import type { AssetStore } from '@icb/media';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { DocumentArchiveService } from '../document-archive.service.js';
import type { BankDocumentDoc } from '../infrastructure/document.schemas.js';
import { ASSET, BRANDING, CUSTOMER_ID, NOW, bankDocumentDoc } from './fixtures.js';

const CONFIG = {
  bank: {
    name: BRANDING.bankName,
    bic: BRANDING.bic,
    sortCode: BRANDING.sortCode,
    country: BRANDING.country,
  },
  media: { signedUrlTtlSeconds: 300 },
} as AppConfiguration;

function setup() {
  const sort = vi.fn();
  const model = {
    create: vi.fn(),
    find: vi.fn(() => ({ sort })),
    findOne: vi.fn(),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const assets = {
    upload: vi.fn().mockResolvedValue(ASSET),
    buildSignedUrl: vi.fn(() => ({ url: 'https://cdn.example/signed', expiresAt: '2026-08-04T10:05:00.000Z' })),
    mintUploadSignature: vi.fn(() => ({ uploadUrl: 'https://uploads.example', folder: 'icb/kyc/cust-1' })),
    destroy: vi.fn().mockResolvedValue(undefined),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new DocumentArchiveService(
    model as unknown as Model<BankDocumentDoc>,
    assets as unknown as AssetStore,
    CONFIG,
    clock,
  );
  return { service, model, assets, sort };
}

const STORE_INPUT = {
  customerId: CUSTOMER_ID,
  kind: 'statement' as const,
  title: 'Statement 2026-07 for account 1234564321',
  accountId: 'acct-1',
  ownerId: 'acct-1',
  folder: 'statements' as const,
  filename: 'ICB-statement-1234564321-2026-07.pdf',
  bytes: Buffer.from('%PDF-1.4 test'),
};

describe('DocumentArchiveService.branding', () => {
  it('exposes the configured institution details for the letterhead', () => {
    const { service } = setup();

    expect(service.branding).toEqual(BRANDING);
  });
});

describe('DocumentArchiveService.store', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('uploads the bytes first, then records the document with the frozen timestamp', async () => {
    const created = bankDocumentDoc();
    context.model.create.mockResolvedValue([created]);

    const stored = await context.service.store(STORE_INPUT);

    expect(context.assets.upload).toHaveBeenCalledWith({
      kind: 'statements',
      ownerId: 'acct-1',
      contentType: 'application/pdf',
      bytes: STORE_INPUT.bytes,
      label: STORE_INPUT.title,
      originalFilename: STORE_INPUT.filename,
    });
    expect(context.model.create).toHaveBeenCalledWith([
      expect.objectContaining({
        _id: expect.any(String),
        customerId: CUSTOMER_ID,
        kind: 'statement',
        title: STORE_INPUT.title,
        accountId: 'acct-1',
        asset: ASSET,
        sizeBytes: STORE_INPUT.bytes.byteLength,
        createdAt: NOW,
      }),
    ]);
    expect(stored).toBe(created);
  });

  it('refuses when the insert returns nothing', async () => {
    context.model.create.mockResolvedValue([]);

    await expect(context.service.store(STORE_INPUT)).rejects.toThrow(ConflictError);
  });
});

describe('DocumentArchiveService.listForCustomer', () => {
  it('queries the customer scope, newest first, and returns the lean rows', async () => {
    const { service, model, sort } = setup();
    const docs = [bankDocumentDoc()];
    sort.mockReturnValue({ lean: vi.fn().mockResolvedValue(docs) });

    const listed = await service.listForCustomer(CUSTOMER_ID);

    expect(model.find).toHaveBeenCalledWith({ customerId: CUSTOMER_ID });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1, _id: -1 });
    expect(listed).toBe(docs);
  });
});

describe('DocumentArchiveService.requireForCustomer', () => {
  it('returns the document owned by the customer', async () => {
    const { service, model } = setup();
    const doc = bankDocumentDoc();
    model.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(doc) });

    const found = await service.requireForCustomer('doc-1', CUSTOMER_ID);

    expect(model.findOne).toHaveBeenCalledWith({ _id: 'doc-1', customerId: CUSTOMER_ID });
    expect(found).toBe(doc);
  });

  it('raises a typed not-found when the customer cannot name the document', async () => {
    const { service, model } = setup();
    model.findOne.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });

    await expect(service.requireForCustomer('doc-9', CUSTOMER_ID)).rejects.toThrow(NotFoundError);
  });
});

describe('DocumentArchiveService.downloadLink', () => {
  it('mints a signed link for the configured ttl, flagged for download', () => {
    const { service, assets } = setup();

    const link = service.downloadLink(ASSET, 'ICB-statement-1234564321-2026-07.pdf');

    expect(assets.buildSignedUrl).toHaveBeenCalledWith(ASSET, 300, { download: true });
    expect(link).toEqual({
      url: 'https://cdn.example/signed',
      expiresAt: '2026-08-04T10:05:00.000Z',
      filename: 'ICB-statement-1234564321-2026-07.pdf',
    });
  });
});

describe('DocumentArchiveService.uploadSignature', () => {
  it('delegates the grant to the asset store unchanged', () => {
    const { service, assets } = setup();
    const input = {
      kind: 'kyc' as const,
      ownerId: CUSTOMER_ID,
      contentType: 'image/png',
      sizeBytes: 12_345,
      label: 'passport.png',
    };

    const grant = service.uploadSignature(input);

    expect(assets.mintUploadSignature).toHaveBeenCalledWith(input);
    expect(grant).toEqual({ uploadUrl: 'https://uploads.example', folder: 'icb/kyc/cust-1' });
  });
});

describe('DocumentArchiveService.discard', () => {
  it('removes the asset from the store and the record from the collection', async () => {
    const { service, assets, model } = setup();
    const doc = bankDocumentDoc();

    await service.discard(doc);

    expect(assets.destroy).toHaveBeenCalledWith(ASSET);
    expect(model.deleteOne).toHaveBeenCalledWith({ _id: 'doc-1' });
  });
});
