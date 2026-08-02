import { describe, expect, it } from 'vitest';

import {
  assertUploadAllowed,
  isAllowedMimeType,
  maxUploadBytes,
  resourceTypeFor,
} from '../allow-list.js';
import { MAX_UPLOAD_BYTES } from '../media.constants.js';
import { AssetTooLargeError, UnsupportedMediaTypeError } from '../errors.js';

describe('isAllowedMimeType', () => {
  it('accepts images and PDFs for kyc', () => {
    expect(isAllowedMimeType('kyc', 'image/jpeg')).toBe(true);
    expect(isAllowedMimeType('kyc', 'application/pdf')).toBe(true);
  });

  it('rejects PDFs for avatars', () => {
    expect(isAllowedMimeType('avatars', 'application/pdf')).toBe(false);
  });

  it('rejects images for statements', () => {
    expect(isAllowedMimeType('statements', 'image/png')).toBe(false);
  });

  it('rejects executable types everywhere', () => {
    expect(isAllowedMimeType('kyc', 'application/x-msdownload')).toBe(false);
    expect(isAllowedMimeType('marketing', 'text/html')).toBe(false);
  });
});

describe('assertUploadAllowed', () => {
  it('passes a well-formed upload', () => {
    expect(() =>
      assertUploadAllowed({ kind: 'kyc', contentType: 'image/png', sizeBytes: 1024 }),
    ).not.toThrow();
  });

  it('throws UnsupportedMediaTypeError for a disallowed MIME type', () => {
    expect(() =>
      assertUploadAllowed({ kind: 'avatars', contentType: 'image/gif', sizeBytes: 10 }),
    ).toThrow(UnsupportedMediaTypeError);
  });

  it('throws AssetTooLargeError above the kind ceiling', () => {
    const overLimit = maxUploadBytes('avatars') + 1;
    expect(() =>
      assertUploadAllowed({ kind: 'avatars', contentType: 'image/png', sizeBytes: overLimit }),
    ).toThrow(AssetTooLargeError);
  });

  it('accepts an upload exactly at the ceiling', () => {
    expect(() =>
      assertUploadAllowed({
        kind: 'statements',
        contentType: 'application/pdf',
        sizeBytes: MAX_UPLOAD_BYTES.statements,
      }),
    ).not.toThrow();
  });
});

describe('resourceTypeFor', () => {
  it('treats PDFs as raw assets', () => {
    expect(resourceTypeFor('application/pdf')).toBe('raw');
  });

  it('treats everything else as an image', () => {
    expect(resourceTypeFor('image/webp')).toBe('image');
  });
});
