import { describe, expect, it } from 'vitest';

import { assertAssetRef, buildAssetRef } from '../asset-ref.js';
import { InvalidAssetRefError } from '../errors.js';

const UPLOADED_AT = '2026-01-15T10:30:00.000Z';

describe('buildAssetRef', () => {
  it('builds a minimal contract-valid ref', () => {
    const ref = buildAssetRef({ publicId: 'icb/kyc/cus_1/passport-x', resourceType: 'image', uploadedAt: UPLOADED_AT });
    expect(ref).toEqual({
      provider: 'cloudinary',
      publicId: 'icb/kyc/cus_1/passport-x',
      resourceType: 'image',
      uploadedAt: UPLOADED_AT,
    });
  });

  it('carries optional provider metadata when present', () => {
    const ref = buildAssetRef({
      publicId: 'icb/statements/acc_1/statement-x',
      resourceType: 'raw',
      format: 'pdf',
      bytes: 2048,
      originalFilename: 'january.pdf',
      uploadedAt: UPLOADED_AT,
    });
    expect(ref.format).toBe('pdf');
    expect(ref.bytes).toBe(2048);
    expect(ref.originalFilename).toBe('january.pdf');
  });
});

describe('assertAssetRef', () => {
  it('returns a valid ref unchanged', () => {
    const ref = buildAssetRef({ publicId: 'p', resourceType: 'image', uploadedAt: UPLOADED_AT });
    expect(assertAssetRef(ref)).toEqual(ref);
  });

  it('rejects a raw URL where a ref belongs', () => {
    expect(() => assertAssetRef('https://res.cloudinary.com/x/image/upload/y.jpg')).toThrow(
      InvalidAssetRefError,
    );
  });

  it('rejects a ref from an unknown provider', () => {
    expect(() =>
      assertAssetRef({ provider: 's3', publicId: 'p', resourceType: 'image', uploadedAt: UPLOADED_AT }),
    ).toThrow(InvalidAssetRefError);
  });

  it('rejects a ref missing its upload timestamp', () => {
    expect(() =>
      assertAssetRef({ provider: 'cloudinary', publicId: 'p', resourceType: 'image' }),
    ).toThrow(InvalidAssetRefError);
  });
});
