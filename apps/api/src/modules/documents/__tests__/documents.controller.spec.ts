import type { BankDocument, DownloadLink, UploadSignature } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DocumentsController } from '../documents.controller.js';
import { type DocumentsService } from '../documents.service.js';

const DOCUMENT = { id: 'doc-1', kind: 'statement' } as unknown as BankDocument;
const LINK: DownloadLink = {
  url: 'https://files.example.com/signed/doc-1',
  expiresAt: '2026-08-04T10:05:00.000Z',
  filename: 'statement.pdf',
};
const SIGNATURE: UploadSignature = {
  uploadUrl: 'https://uploads.example.com/cust-1',
  fields: { key: 'cust-1/doc-2' },
  expiresAt: '2026-08-04T10:05:00.000Z',
} as unknown as UploadSignature;

describe('DocumentsController', () => {
  let documents: {
    list: ReturnType<typeof vi.fn>;
    downloadLink: ReturnType<typeof vi.fn>;
    uploadSignature: ReturnType<typeof vi.fn>;
    issueLetter: ReturnType<typeof vi.fn>;
  };
  let controller: DocumentsController;

  beforeEach(() => {
    documents = {
      list: vi.fn().mockResolvedValue([DOCUMENT]),
      downloadLink: vi.fn().mockResolvedValue(LINK),
      uploadSignature: vi.fn().mockReturnValue(SIGNATURE),
      issueLetter: vi.fn().mockResolvedValue(DOCUMENT),
    };
    controller = new DocumentsController(documents as unknown as DocumentsService);
  });

  it('lists the caller documents wrapped in an items envelope', async () => {
    const result = await controller.list('cust-1');

    expect(documents.list).toHaveBeenCalledWith('cust-1');
    expect(result).toEqual({ items: [DOCUMENT] });
  });

  it('returns a signed download link scoped to the caller', async () => {
    const result = await controller.download('cust-1', 'doc-1');

    expect(documents.downloadLink).toHaveBeenCalledWith('cust-1', 'doc-1');
    expect(result).toBe(LINK);
  });

  it('mints an upload signature for the caller folder', () => {
    const body = { filename: 'id.pdf', contentType: 'application/pdf', byteSize: 1024 };

    const result = controller.uploadSignature('cust-1', body as never);

    expect(documents.uploadSignature).toHaveBeenCalledWith('cust-1', body);
    expect(result).toBe(SIGNATURE);
  });

  it('issues a letter for the caller', async () => {
    const body = { kind: 'balance_confirmation', accountId: 'acct-1' };

    const result = await controller.issueLetter('cust-1', body as never);

    expect(documents.issueLetter).toHaveBeenCalledWith('cust-1', body);
    expect(result).toBe(DOCUMENT);
  });

  it('propagates service errors instead of swallowing them', async () => {
    documents.downloadLink.mockRejectedValue(new Error('not found'));

    await expect(controller.download('cust-1', 'doc-9')).rejects.toThrow('not found');
  });
});
