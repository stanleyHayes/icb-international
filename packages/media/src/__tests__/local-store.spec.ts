import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { assetRefSchema } from '@icb/contracts';

import { LocalAssetStore } from '../local-store.js';
import { UnsafeAssetPathError } from '../errors.js';

const NOW = 1_700_000_000_000;

let rootDir: string;

function makeStore(overrides: Partial<ConstructorParameters<typeof LocalAssetStore>[0]> = {}) {
  return new LocalAssetStore(
    { rootDir, baseUrl: 'http://localhost:3001', ...overrides },
    { now: () => NOW, generateId: () => 'uid-1' },
  );
}

beforeEach(async () => {
  rootDir = await mkdtemp(join(tmpdir(), 'icb-media-'));
});

afterEach(async () => {
  await rm(rootDir, { recursive: true, force: true });
});

describe('mintUploadSignature', () => {
  it('mirrors the cloudinary grant shape against the local upload endpoint', () => {
    const grant = makeStore().mintUploadSignature({
      kind: 'kyc',
      ownerId: 'cus_1',
      contentType: 'image/png',
      sizeBytes: 100,
      label: 'passport',
    });

    expect(grant.uploadUrl).toBe('http://localhost:3001/v1/media/local-upload');
    expect(grant.apiKey).toBe('local');
    expect(grant.folder).toBe('icb/kyc/cus_1');
    expect(grant.publicId).toBe('passport-uid-1');
    expect(grant.signature).toMatch(/^[0-9a-f]{40}$/);
    expect(grant.expiresAt).toBe('2023-11-14T22:18:20.000Z');
  });

  it('accepts a custom upload path and TTL', () => {
    const grant = makeStore({ uploadPath: '/upload-here', uploadSignatureTtlSeconds: 10 })
      .mintUploadSignature({ kind: 'avatars', ownerId: 'cus_1', contentType: 'image/png', sizeBytes: 1 });
    expect(grant.uploadUrl).toBe('http://localhost:3001/upload-here');
    expect(grant.expiresAt).toBe('2023-11-14T22:13:30.000Z');
  });
});

describe('save', () => {
  it('persists bytes under rootDir and returns a contract-valid ref', async () => {
    const store = makeStore({ rootFolder: 'icb' });
    const bytes = new Uint8Array([1, 2, 3, 4]);

    const ref = await store.save({
      folder: 'icb/kyc/cus_1',
      publicId: 'passport-uid-1',
      contentType: 'image/png',
      bytes,
      originalFilename: 'scan.png',
    });

    expect(assetRefSchema.safeParse(ref).success).toBe(true);
    expect(ref).toMatchObject({
      provider: 'cloudinary',
      publicId: 'icb/kyc/cus_1/passport-uid-1',
      resourceType: 'image',
      format: 'png',
      bytes: 4,
      originalFilename: 'scan.png',
    });
    const persisted = await readFile(join(rootDir, 'icb/kyc/cus_1/passport-uid-1.png'));
    expect(persisted).toEqual(Buffer.from(bytes));
  });

  it('stores a PDF as a raw asset with a pdf extension', async () => {
    const ref = await makeStore().save({
      folder: 'icb/statements/acc_1',
      publicId: 'statement-uid-1',
      contentType: 'application/pdf',
      bytes: new Uint8Array([37, 80, 68, 70]),
    });
    expect(ref.resourceType).toBe('raw');
    expect(ref.format).toBe('pdf');
    await readFile(join(rootDir, 'icb/statements/acc_1/statement-uid-1.pdf'));
  });

  it('refuses paths that could escape the storage root', async () => {
    await expect(
      makeStore().save({
        folder: '../outside',
        publicId: 'x',
        contentType: 'image/png',
        bytes: new Uint8Array([1]),
      }),
    ).rejects.toThrow(UnsafeAssetPathError);
  });
});

describe('signedDeliveryUrl', () => {
  it('embeds an expiry and a verifiable HMAC', async () => {
    const store = makeStore();
    const ref = await store.save({
      folder: 'icb/kyc/cus_1',
      publicId: 'passport-uid-1',
      contentType: 'image/png',
      bytes: new Uint8Array([1]),
    });

    const link = store.signedDeliveryUrl(ref);
    const url = new URL(link.url);
    const exp = Number(url.searchParams.get('exp'));
    const sig = url.searchParams.get('sig') ?? '';

    expect(url.pathname).toBe('/media/icb/kyc/cus_1/passport-uid-1.png');
    expect(exp).toBe(1_700_000_300);
    expect(link.expiresAt).toBe('2023-11-14T22:18:20.000Z');
    expect(store.verifyDeliverySignature('icb/kyc/cus_1/passport-uid-1.png', exp, sig)).toBe(true);
    expect(store.verifyDeliverySignature('icb/kyc/cus_1/other.png', exp, sig)).toBe(false);
  });

  it('honours custom delivery prefix, secret, and TTL', async () => {
    const store = makeStore({
      deliveryPathPrefix: '/files',
      signingSecret: 'test-secret',
      deliveryUrlTtlSeconds: 60,
    });
    const ref = await store.save({
      folder: 'icb/avatars/cus_1',
      publicId: 'avatar-uid-1',
      contentType: 'image/jpeg',
      bytes: new Uint8Array([1]),
    });
    const link = store.signedDeliveryUrl(ref, { expiresInSeconds: 15 });
    expect(link.url.startsWith('http://localhost:3001/files/')).toBe(true);
    expect(link.expiresAt).toBe('2023-11-14T22:13:35.000Z');
  });
});
