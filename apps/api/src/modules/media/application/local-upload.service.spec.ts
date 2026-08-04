import {
  LocalAssetStore,
  canonicalUploadParams,
  signUploadParamsSha1,
  type AssetStore,
} from '@icb/media';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError, ValidationError } from '../../../common/errors/index.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import type { ClockService } from '../../../simulation/clock/clock.service.js';
import {
  LocalUploadService,
  type LocalUploadFile,
  type LocalUploadGrant,
} from './local-upload.service.js';

const SECRET = 'icb-local-upload';
const NOW_MS = Date.parse('2026-08-03T10:00:00.000Z');
const TIMESTAMP = Math.floor(NOW_MS / 1000);
const FOLDER = 'icb/kyc/cust-1';
const PUBLIC_ID = 'passport-01JABC';

const REF = {
  provider: 'cloudinary',
  publicId: `${FOLDER}/${PUBLIC_ID}`,
  resourceType: 'image',
  format: 'png',
  bytes: 4,
  originalFilename: 'passport.png',
  uploadedAt: '2026-08-03T10:00:00.000Z',
} as const;

/** Real PNG magic bytes — the service sniffs content, so fixtures must be what they claim. */
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const PDF_BYTES = new TextEncoder().encode('%PDF-1.4 fake document bytes');

function file(overrides: Partial<LocalUploadFile> = {}): LocalUploadFile {
  return {
    contentType: 'image/png',
    originalFilename: 'passport.png',
    bytes: PNG_BYTES,
    ...overrides,
  };
}

/** A grant signed the way the kyc minter signs it (no delivery `type` parameter). */
function kycGrant(overrides: Partial<LocalUploadGrant> = {}): LocalUploadGrant {
  return {
    apiKey: 'local',
    folder: FOLDER,
    publicId: PUBLIC_ID,
    timestamp: TIMESTAMP,
    signature: signUploadParamsSha1(
      { folder: FOLDER, public_id: PUBLIC_ID, timestamp: TIMESTAMP },
      SECRET,
    ),
    ...overrides,
  };
}

/** A grant signed the way the support minter signs it (delivery `type` included). */
function supportGrant(): LocalUploadGrant {
  return {
    ...kycGrant(),
    signature: signUploadParamsSha1(canonicalUploadParams(FOLDER, PUBLIC_ID, TIMESTAMP), SECRET),
  };
}

function storeDouble(): { store: LocalAssetStore; save: ReturnType<typeof vi.fn> } {
  const save = vi.fn().mockResolvedValue({ ...REF });
  const store = Object.assign(Object.create(LocalAssetStore.prototype) as LocalAssetStore, {
    save,
  });
  return { store, save };
}

describe('LocalUploadService', () => {
  let store: ReturnType<typeof storeDouble>['store'];
  let save: ReturnType<typeof vi.fn>;
  let service: LocalUploadService;

  beforeEach(() => {
    ({ store, save } = storeDouble());
    service = new LocalUploadService(
      store,
      { media: { apiSecret: '', signedUrlTtlSeconds: 300 } } as unknown as AppConfiguration,
      { epochMs: () => NOW_MS } as unknown as ClockService,
    );
  });

  it('accepts a valid kyc-scheme grant and answers in the provider’s shape', async () => {
    const response = await service.accept(kycGrant(), file());

    expect(save).toHaveBeenCalledWith({
      folder: FOLDER,
      publicId: PUBLIC_ID,
      contentType: 'image/png',
      bytes: file().bytes,
      originalFilename: 'passport.png',
    });
    expect(response).toEqual({
      public_id: REF.publicId,
      resource_type: 'image',
      format: 'png',
      bytes: 4,
      original_filename: 'passport.png',
    });
  });

  it('accepts the support scheme, which signs the delivery type as well', async () => {
    await expect(service.accept(supportGrant(), file())).resolves.toMatchObject({
      public_id: REF.publicId,
    });
  });

  it('rejects a grant for the wrong api key', async () => {
    await expect(service.accept(kycGrant({ apiKey: 'not-local' }), file())).rejects.toThrow(
      ValidationError,
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an expired grant', async () => {
    const stale = TIMESTAMP - 301;
    const grant = kycGrant({
      timestamp: stale,
      signature: signUploadParamsSha1(
        { folder: FOLDER, public_id: PUBLIC_ID, timestamp: stale },
        SECRET,
      ),
    });

    await expect(service.accept(grant, file())).rejects.toThrow(/expired/);
  });

  it('rejects a signature that does not cover the posted parameters', async () => {
    await expect(
      service.accept(kycGrant({ signature: 'deadbeef' }), file()),
    ).rejects.toThrow(ValidationError);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects a MIME type outside the kind’s allow-list', async () => {
    await expect(
      service.accept(kycGrant(), file({ contentType: 'image/gif' })),
    ).rejects.toThrow(ValidationError);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects a file above the size ceiling', async () => {
    const oversized = file({ bytes: new Uint8Array(15 * 1024 * 1024 + 1) });

    await expect(service.accept(kycGrant(), oversized)).rejects.toThrow(/exceeds/);
  });

  it('rejects bytes that are not what the declared content-type claims', async () => {
    // A PDF renamed to passport.png: the declared type passes the allow-list, the bytes betray it.
    const disguised = file({ bytes: PDF_BYTES });

    await expect(service.accept(kycGrant(), disguised)).rejects.toThrow(/does not match/);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects bytes with no recognised signature at all', async () => {
    const executable = file({ bytes: new Uint8Array([0x7f, 0x45, 0x4c, 0x46, 2, 1, 1, 0]) });

    await expect(service.accept(kycGrant(), executable)).rejects.toThrow(/does not match/);
    expect(save).not.toHaveBeenCalled();
  });

  it('accepts a genuine PDF declared as a PDF', async () => {
    await expect(
      service.accept(
        kycGrant(),
        file({ contentType: 'application/pdf', originalFilename: 'id.pdf', bytes: PDF_BYTES }),
      ),
    ).resolves.toMatchObject({ public_id: REF.publicId });
  });

  it('does not exist when the bound store is a real provider', async () => {
    const cloudService = new LocalUploadService(
      {} as AssetStore,
      { media: { apiSecret: '', signedUrlTtlSeconds: 300 } } as unknown as AppConfiguration,
      { epochMs: () => NOW_MS } as unknown as ClockService,
    );

    await expect(cloudService.accept(kycGrant(), file())).rejects.toThrow(NotFoundError);
  });
});
