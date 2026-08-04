import type { UploadSignatureRequest } from '@icb/contracts';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { ValidationError } from '../../../common/errors/index.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { UploadSignatureService } from '../application/upload-signature.service.js';
import { CUSTOMER_ID, NOW } from './fixtures.js';

const TTL_SECONDS = 300;

function configFor(overrides: Record<string, unknown> = {}): AppConfiguration {
  return {
    media: {
      enabled: false,
      cloudName: '',
      apiKey: '',
      apiSecret: '',
      folder: 'icb',
      signedUrlTtlSeconds: TTL_SECONDS,
      ...overrides,
    },
    http: { host: '0.0.0.0', port: 3001 },
  } as AppConfiguration;
}

const CLOUD = configFor({
  enabled: true,
  cloudName: 'icb-demo',
  apiKey: 'cloud-key',
  apiSecret: 'cloud-secret',
});

function setup(config: AppConfiguration = configFor()) {
  const clock = new ClockService();
  clock.freeze(NOW);
  return new UploadSignatureService(config, clock);
}

// Cloudinary's signed-upload scheme is SHA-1, so the expected value has to be recomputed the same
// way; nothing secret is hashed here and the digest never leaves the assertion.
function sign(canonical: string, secret: string): string {
  // eslint-disable-next-line sonarjs/hashing -- mirrors the SHA-1 digest Cloudinary mandates for upload signatures; recomputing it is the assertion, not a security choice
  return createHash('sha1').update(`${canonical}${secret}`).digest('hex');
}

function request(overrides: Partial<UploadSignatureRequest> = {}): UploadSignatureRequest {
  return {
    documentType: 'passport',
    filename: 'passport.png',
    contentType: 'image/png',
    sizeBytes: 12_345,
    ...overrides,
  };
}

describe('UploadSignatureService.mint against the local store', () => {
  it('points at the local upload path with the local key and the customer folder', () => {
    const signature = setup().mint(CUSTOMER_ID, request());

    expect(signature.uploadUrl).toBe('http://localhost:3001/v1/media/local-upload');
    expect(signature.apiKey).toBe('local');
    expect(signature.folder).toBe(`icb/kyc/${CUSTOMER_ID}`);
    expect(signature.publicId).toMatch(/^passport-/);
  });

  it('rewrites the bind address into something a browser can post to', () => {
    const config = configFor();
    (config as { http: { host: string } }).http.host = '127.0.0.1';

    expect(setup(config).mint(CUSTOMER_ID, request()).uploadUrl).toBe(
      'http://127.0.0.1:3001/v1/media/local-upload',
    );
  });

  it('signs the folder, wire-named public id and timestamp with the local secret', () => {
    const signature = setup().mint(CUSTOMER_ID, request());

    const canonical = `folder=${signature.folder}&public_id=${signature.publicId}&timestamp=${String(
      signature.timestamp,
    )}`;
    const expected = sign(canonical, 'icb-local-upload');
    expect(signature.signature).toBe(expected);
  });
});

describe('UploadSignatureService.mint against Cloudinary', () => {
  it('builds the provider upload URL for the resource type and uses the configured key', () => {
    const image = setup(CLOUD).mint(CUSTOMER_ID, request());
    const raw = setup(CLOUD).mint(CUSTOMER_ID, request({ contentType: 'application/pdf' }));

    expect(image.uploadUrl).toBe('https://api.cloudinary.com/v1_1/icb-demo/image/upload');
    expect(raw.uploadUrl).toBe('https://api.cloudinary.com/v1_1/icb-demo/raw/upload');
    expect(image.apiKey).toBe('cloud-key');
  });

  it('signs with the configured secret instead of the local one', () => {
    const signature = setup(CLOUD).mint(CUSTOMER_ID, request());

    const canonical = `folder=${signature.folder}&public_id=${signature.publicId}&timestamp=${String(
      signature.timestamp,
    )}`;
    const expected = sign(canonical, 'cloud-secret');
    expect(signature.signature).toBe(expected);
  });
});

describe('UploadSignatureService.mint timing and validation', () => {
  it('derives the timestamp and expiry from the frozen clock', () => {
    const signature = setup(CLOUD).mint(CUSTOMER_ID, request());

    expect(signature.timestamp).toBe(Math.floor(NOW.getTime() / 1000));
    expect(signature.expiresAt).toBe(new Date(NOW.getTime() + TTL_SECONDS * 1000).toISOString());
  });

  it('refuses a PDF masquerading as a selfie', () => {
    expect(() =>
      setup().mint(
        CUSTOMER_ID,
        request({ documentType: 'selfie', contentType: 'application/pdf' }),
      ),
    ).toThrow(ValidationError);
  });

  it('accepts a PDF for any document that is not a selfie', () => {
    const signature = setup().mint(CUSTOMER_ID, request({ contentType: 'application/pdf' }));

    expect(signature.publicId).toMatch(/^passport-/);
  });
});
