import { canonicalUploadParams, signUploadParamsSha1 } from '@icb/media';
import { describe, expect, it } from 'vitest';

import type { AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import {
  AttachmentSignatureService,
  type AttachmentUploadRequest,
} from '../application/attachment-signature.service.js';
import {
  LOCAL_API_KEY,
  LOCAL_SIGNING_SECRET,
  LOCAL_UPLOAD_PATH,
} from '../support.constants.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');
const NOW_SECONDS = Math.floor(NOW.getTime() / 1000);

const IMAGE_REQUEST: AttachmentUploadRequest = {
  filename: 'card-photo.jpg',
  contentType: 'image/jpeg',
  sizeBytes: 120_000,
};

function config(overrides: Partial<AppConfiguration['media']> = {}): AppConfiguration {
  return {
    http: { host: '127.0.0.1', port: 4100 },
    media: {
      cloudName: 'icb-cloud',
      apiKey: 'cloud-key',
      apiSecret: 'cloud-secret',
      folder: 'icb',
      signedUrlTtlSeconds: 300,
      enabled: true,
      ...overrides,
    },
  } as AppConfiguration;
}

function setup(configuration: AppConfiguration): AttachmentSignatureService {
  const clock = new ClockService();
  clock.freeze(NOW);
  return new AttachmentSignatureService(configuration, clock);
}

function expectedSignature(secret: string, folder: string, publicId: string): string {
  return signUploadParamsSha1(canonicalUploadParams(folder, publicId, NOW_SECONDS), secret);
}

describe('AttachmentSignatureService.mint — provider configured', () => {
  it('mints a signature scoped to the customer folder', () => {
    const service = setup(config());

    const minted = service.mint('cus-1', IMAGE_REQUEST);

    expect(minted.folder).toBe('icb/support/cus-1');
    expect(minted.timestamp).toBe(NOW_SECONDS);
    expect(minted.apiKey).toBe('cloud-key');
    expect(minted.publicId.startsWith('card-photo-jpg-')).toBe(true);
    expect(minted.signature).toBe(
      expectedSignature('cloud-secret', 'icb/support/cus-1', minted.publicId),
    );
    expect(minted.expiresAt).toBe(new Date(NOW.getTime() + 300_000).toISOString());
  });

  it('posts images to the image resource endpoint', () => {
    const service = setup(config());

    const minted = service.mint('cus-1', IMAGE_REQUEST);

    expect(minted.uploadUrl).toBe('https://api.cloudinary.com/v1_1/icb-cloud/image/upload');
  });

  it('posts PDFs to the raw resource endpoint', () => {
    const service = setup(config());

    const minted = service.mint('cus-1', {
      filename: 'statement.pdf',
      contentType: 'application/pdf',
      sizeBytes: 85_000,
    });

    expect(minted.uploadUrl).toBe('https://api.cloudinary.com/v1_1/icb-cloud/raw/upload');
    expect(minted.publicId.startsWith('statement-pdf-')).toBe(true);
  });
});

describe('AttachmentSignatureService.mint — local fallback', () => {
  it('points at the local upload path with the local api key', () => {
    const service = setup(config({ enabled: false }));

    const minted = service.mint('cus-1', IMAGE_REQUEST);

    expect(minted.uploadUrl).toBe(`http://127.0.0.1:4100${LOCAL_UPLOAD_PATH}`);
    expect(minted.apiKey).toBe(LOCAL_API_KEY);
    // The signing secret is independent of `enabled`: a configured secret is still used.
    expect(minted.signature).toBe(
      expectedSignature('cloud-secret', 'icb/support/cus-1', minted.publicId),
    );
  });

  it('rewrites the 0.0.0.0 bind address to localhost for browsers', () => {
    const configuration = config({ enabled: false });
    const service = setup({
      ...configuration,
      http: { host: '0.0.0.0', port: 4100 },
    } as AppConfiguration);

    const minted = service.mint('cus-1', IMAGE_REQUEST);

    expect(minted.uploadUrl).toBe(`http://localhost:4100${LOCAL_UPLOAD_PATH}`);
  });

  it('signs with the local secret when no API secret is configured', () => {
    const service = setup(config({ enabled: false, apiSecret: '' }));

    const minted = service.mint('cus-1', IMAGE_REQUEST);

    expect(minted.signature).toBe(
      expectedSignature(LOCAL_SIGNING_SECRET, 'icb/support/cus-1', minted.publicId),
    );
  });

  it('prefers the configured secret over the local fallback', () => {
    const service = setup(config({ enabled: false, apiSecret: 'real-secret' }));

    const minted = service.mint('cus-1', IMAGE_REQUEST);

    expect(minted.signature).toBe(
      expectedSignature('real-secret', 'icb/support/cus-1', minted.publicId),
    );
  });
});

describe('AttachmentSignatureService.mint — expiry', () => {
  it('derives the expiry from the configured TTL against the frozen clock', () => {
    const service = setup(config({ signedUrlTtlSeconds: 60 }));

    const minted = service.mint('cus-1', IMAGE_REQUEST);

    expect(minted.expiresAt).toBe('2026-08-04T10:01:00.000Z');
  });
});
