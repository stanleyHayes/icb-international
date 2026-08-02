import { assetRefSchema, type AssetRef } from '@icb/contracts';

import { InvalidAssetRefError } from './errors.js';
import type { AssetResourceType } from './document-kind.js';

/**
 * The value stored on documents in place of a raw URL. Defined once in `@icb/contracts`
 * (the source of truth) and re-exported here so media consumers import it from one place.
 */
export type { AssetRef } from '@icb/contracts';

/** Provider-supplied facts about an asset after a successful upload. */
export interface UploadedAssetInfo {
  publicId: string;
  resourceType: AssetResourceType;
  format?: string;
  bytes?: number;
  originalFilename?: string;
  uploadedAt: string;
}

/**
 * Builds a contract-valid `assetRef`. `provider` is always `'cloudinary'`: the local
 * stand-in emulates Cloudinary, and stored refs must satisfy `assetRefSchema` regardless
 * of which store produced them.
 */
export function buildAssetRef(info: UploadedAssetInfo): AssetRef {
  return assertAssetRef({
    provider: 'cloudinary',
    publicId: info.publicId,
    resourceType: info.resourceType,
    uploadedAt: info.uploadedAt,
    ...(info.format !== undefined ? { format: info.format } : {}),
    ...(info.bytes !== undefined ? { bytes: info.bytes } : {}),
    ...(info.originalFilename !== undefined ? { originalFilename: info.originalFilename } : {}),
  });
}

/** Validates an unknown value against the contract schema; the boundary guard for refs. */
export function assertAssetRef(value: unknown): AssetRef {
  const parsed = assetRefSchema.safeParse(value);
  if (!parsed.success) {
    const reason = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new InvalidAssetRefError(reason);
  }
  return parsed.data;
}
