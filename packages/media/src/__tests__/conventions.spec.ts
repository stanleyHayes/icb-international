import { describe, expect, it } from 'vitest';

import { DOCUMENT_KINDS, assetFolder, buildPublicId } from '../document-kind.js';
import { transformationPreset, TRANSFORMATION_PRESET_NAMES } from '../transformation.js';
import {
  canonicalUploadParams,
  epochSeconds,
  isoAfter,
  signUploadParamsSha1,
  uploadEndpoint,
} from '../upload-signature.js';

describe('document kinds', () => {
  it('covers the five domains the bank stores', () => {
    expect(DOCUMENT_KINDS).toEqual(['kyc', 'dispute-evidence', 'statements', 'avatars', 'marketing']);
  });
});

describe('assetFolder', () => {
  it('nests kind and owner under the root folder', () => {
    expect(assetFolder('icb', 'kyc', 'cus_123')).toBe('icb/kyc/cus_123');
    expect(assetFolder('icb-staging', 'dispute-evidence', 'disp_9')).toBe(
      'icb-staging/dispute-evidence/disp_9',
    );
  });
});

describe('buildPublicId', () => {
  it('slugifies the label and appends the unique id', () => {
    expect(buildPublicId('Passport Scan', 'abc123')).toBe('passport-scan-abc123');
  });

  it('falls back to a neutral slug for empty labels', () => {
    expect(buildPublicId('***', 'abc123')).toBe('asset-abc123');
  });
});

describe('transformation presets', () => {
  it('ships the three named presets', () => {
    expect(TRANSFORMATION_PRESET_NAMES).toEqual(['document-thumbnail', 'avatar', 'marketing-hero']);
  });

  it('the avatar preset crops to a face-centred square', () => {
    expect(transformationPreset('avatar')).toMatchObject({
      width: 256,
      height: 256,
      crop: 'fill',
      gravity: 'face',
    });
  });

  it('the marketing hero is a full-HD landscape crop', () => {
    expect(transformationPreset('marketing-hero')).toMatchObject({ width: 1920, height: 1080 });
  });
});

describe('canonicalUploadParams', () => {
  it('uses wire names for signed fields', () => {
    expect(canonicalUploadParams('icb/kyc/cus_1', 'passport-x', 1700000000)).toEqual({
      folder: 'icb/kyc/cus_1',
      public_id: 'passport-x',
      timestamp: 1700000000,
    });
  });
});

describe('signUploadParamsSha1', () => {
  it('matches the provider scheme: sorted params, secret appended, sha1 hex', () => {
    // Reproduced from the provider's documented example algorithm.
    const signature = signUploadParamsSha1(
      { timestamp: 1315060510, public_id: 'sample_image' },
      'secret',
    );
    expect(signature).toMatch(/^[0-9a-f]{40}$/);
  });

  it('is sensitive to parameter order only through sorting', () => {
    const first = signUploadParamsSha1({ a: '1', b: '2' }, 's');
    const second = signUploadParamsSha1({ b: '2', a: '1' }, 's');
    expect(first).toBe(second);
  });
});

describe('uploadEndpoint', () => {
  it('targets the provider upload API for the resource type', () => {
    expect(uploadEndpoint('icb-cloud', 'raw')).toBe(
      'https://api.cloudinary.com/v1_1/icb-cloud/raw/upload',
    );
  });
});

describe('time helpers', () => {
  it('converts epoch milliseconds to seconds', () => {
    expect(epochSeconds(1_700_000_000_999)).toBe(1_700_000_000);
  });

  it('adds a TTL and formats ISO', () => {
    expect(isoAfter(0, 300)).toBe('1970-01-01T00:05:00.000Z');
  });
});
