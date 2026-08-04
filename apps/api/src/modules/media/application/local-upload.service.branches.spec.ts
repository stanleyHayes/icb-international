import { LocalAssetStore, MediaError, signUploadParamsSha1 } from '@icb/media';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ValidationError } from '../../../common/errors/index.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import {
  LocalUploadService,
  type LocalUploadFile,
  type LocalUploadGrant,
} from './local-upload.service.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');
const TIMESTAMP = Math.floor(NOW.getTime() / 1000);
const TTL_SECONDS = 300;

/** Real PNG magic bytes — the service sniffs content, so fixtures must be what they claim. */
const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);

function file(overrides: Partial<LocalUploadFile> = {}): LocalUploadFile {
  return {
    contentType: 'image/png',
    originalFilename: 'capture.png',
    bytes: PNG_BYTES,
    ...overrides,
  };
}

function grant(folder: string, secret: string, timestamp = TIMESTAMP): LocalUploadGrant {
  return {
    apiKey: 'local',
    folder,
    publicId: 'asset-01',
    timestamp,
    signature: signUploadParamsSha1({ folder, public_id: 'asset-01', timestamp }, secret),
  };
}

function config(apiSecret = ''): AppConfiguration {
  return {
    media: { apiSecret, signedUrlTtlSeconds: TTL_SECONDS },
  } as unknown as AppConfiguration;
}

function storeDouble(save: ReturnType<typeof vi.fn>): LocalAssetStore {
  return Object.assign(Object.create(LocalAssetStore.prototype) as LocalAssetStore, { save });
}

describe('LocalUploadService — uncovered branches', () => {
  let save: ReturnType<typeof vi.fn>;
  let clock: ClockService;
  let service: LocalUploadService;

  beforeEach(() => {
    save = vi.fn().mockResolvedValue({
      provider: 'cloudinary',
      publicId: 'icb/support/ticket-1/asset-01',
      resourceType: 'image',
    });
    clock = new ClockService();
    clock.freeze(NOW);
    service = new LocalUploadService(storeDouble(save), config(), clock);
  });

  it('verifies the signature against the configured api secret when one exists', async () => {
    const secretService = new LocalUploadService(storeDouble(save), config('real-secret'), clock);

    await secretService.accept(grant('icb/kyc/cust-1', 'real-secret'), file());
    expect(save).toHaveBeenCalledTimes(1);

    save.mockClear();
    await expect(
      secretService.accept(grant('icb/kyc/cust-1', 'wrong-secret'), file()),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(save).not.toHaveBeenCalled();
  });

  it('applies the global allow-list to a folder outside the document kinds', async () => {
    const response = await service.accept(grant('icb/support/ticket-1', 'icb-local-upload'), file());

    expect(save).toHaveBeenCalledWith(expect.objectContaining({ folder: 'icb/support/ticket-1' }));
    expect(response.public_id).toBe('icb/support/ticket-1/asset-01');
  });

  it('rejects an unsupported MIME for a non-kind folder, naming the folder segment', async () => {
    await expect(
      service.accept(grant('icb/support/ticket-1', 'icb-local-upload'), file({ contentType: 'image/gif' })),
    ).rejects.toThrow(/not allowed for support assets/);
    expect(save).not.toHaveBeenCalled();
  });

  it('labels a folder with no second segment as unknown in the allow-list error', async () => {
    await expect(
      service.accept(grant('icb', 'icb-local-upload'), file({ contentType: 'image/gif' })),
    ).rejects.toThrow(/not allowed for unknown assets/);
    expect(save).not.toHaveBeenCalled();
  });

  it('rejects an oversized file for a non-kind folder under the global ceiling', async () => {
    const oversized = file({ bytes: new Uint8Array(15 * 1024 * 1024 + 1) });

    await expect(
      service.accept(grant('icb/support/ticket-1', 'icb-local-upload'), oversized),
    ).rejects.toThrow(/exceeds/);
    expect(save).not.toHaveBeenCalled();
  });

  it('wraps a MediaError raised by the store as a ValidationError', async () => {
    save.mockRejectedValue(new MediaError('disk full'));

    await expect(
      service.accept(grant('icb/kyc/cust-1', 'icb-local-upload'), file()),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED', message: 'disk full' });
  });

  it('rethrows a store failure that is not a MediaError unchanged', async () => {
    const failure = new TypeError('socket hangup');
    save.mockRejectedValue(failure);

    const caught = await service
      .accept(grant('icb/kyc/cust-1', 'icb-local-upload'), file())
      .catch((error: unknown) => error);

    expect(caught).toBe(failure);
  });

  it('omits the optional response fields the store ref does not carry', async () => {
    const response = await service.accept(grant('icb/kyc/cust-1', 'icb-local-upload'), file());

    expect(response).toEqual({
      public_id: 'icb/support/ticket-1/asset-01',
      resource_type: 'image',
    });
    expect(response).not.toHaveProperty('format');
    expect(response).not.toHaveProperty('bytes');
    expect(response).not.toHaveProperty('original_filename');
  });

  it('accepts a grant whose remaining lifetime is exactly the ttl boundary', async () => {
    const boundary = grant('icb/kyc/cust-1', 'icb-local-upload', TIMESTAMP - TTL_SECONDS);

    await service.accept(boundary, file());
    expect(save).toHaveBeenCalledTimes(1);
  });
});
