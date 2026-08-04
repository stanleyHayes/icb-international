import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LocalAssetStore, type AssetRef } from '@icb/media';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import { LocalDeliveryService } from '../application/local-delivery.service.js';

const FILE_BYTES = new TextEncoder().encode('%PDF-1.4 fake statement bytes');

interface SignedLink {
  path: string;
  exp: number;
  sig: string;
}

function parseLink(url: string): SignedLink {
  const parsed = new URL(url);
  const path = parsed.pathname.replace('/v1/media/delivery/', '');
  return {
    path,
    exp: Number(parsed.searchParams.get('exp')),
    sig: parsed.searchParams.get('sig') ?? '',
  };
}

async function drain(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

describe('LocalDeliveryService', () => {
  let rootDir: string;
  let store: LocalAssetStore;
  let service: LocalDeliveryService;
  let ref: AssetRef;

  beforeAll(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'icb-media-'));
    store = new LocalAssetStore({
      rootDir,
      baseUrl: 'http://localhost:3001',
      deliveryPathPrefix: '/v1/media/delivery',
    });
    service = new LocalDeliveryService(store, rootDir, new ClockService());
    ref = await store.save({
      folder: 'icb/statements',
      publicId: 'statement-test1',
      contentType: 'application/pdf',
      bytes: FILE_BYTES,
      originalFilename: 'statement.pdf',
    });
  });

  afterAll(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it('streams a stored asset when the link signature and expiry check out', async () => {
    const link = parseLink(store.buildSignedUrl(ref).url);

    const file = await service.open(link.path, link.exp, link.sig);

    expect(file.contentType).toBe('application/pdf');
    expect(file.sizeBytes).toBe(FILE_BYTES.byteLength);
    expect(file.filename).toBe('statement-test1.pdf');
    expect(await drain(file.stream)).toEqual(Buffer.from(FILE_BYTES));
  });

  it('refuses a tampered signature', async () => {
    const link = parseLink(store.buildSignedUrl(ref).url);

    await expect(service.open(link.path, link.exp, `${link.sig}0`)).rejects.toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }) as Error,
    );
  });

  it('refuses an expired link even when the signature is genuine', async () => {
    const link = parseLink(store.buildSignedUrl(ref, -60).url);

    await expect(service.open(link.path, link.exp, link.sig)).rejects.toThrow(
      expect.objectContaining({ code: 'FORBIDDEN' }) as Error,
    );
  });

  it('refuses a signed link that names no stored file', async () => {
    const ghost = { publicId: 'icb/statements/ghost-1', format: 'pdf' } as AssetRef;
    const link = parseLink(store.buildSignedUrl(ghost).url);

    await expect(service.open(link.path, link.exp, link.sig)).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }) as Error,
    );
  });

  it('rejects a traversal path before touching the filesystem', async () => {
    await expect(service.open('../../etc/passwd', 4_000_000_000, 'x')).rejects.toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }) as Error,
    );
  });

  it('does not exist when the configured store is a real provider', async () => {
    const cloudService = new LocalDeliveryService({} as never, rootDir, new ClockService());

    await expect(cloudService.open('icb/statements/x.pdf', 4_000_000_000, 'x')).rejects.toThrow(
      expect.objectContaining({ code: 'NOT_FOUND' }) as Error,
    );
  });
});
