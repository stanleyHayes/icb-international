import type { AssetResourceType } from './document-kind.js';
import type { TransformationPreset } from './transformation.js';

/**
 * The port boundary. Everything the package needs from the Cloudinary client is expressed
 * in these interfaces, in package-owned types only. Unit tests substitute fakes here;
 * `cloudinary-adapter.ts` is the single file that knows the real client exists.
 */

/** Identifies one stored asset well enough to deliver or delete it. */
export interface CloudinaryAssetLocator {
  publicId: string;
  resourceType: AssetResourceType;
}

export interface CloudinaryUploadRequest {
  folder: string;
  publicId: string;
  resourceType: AssetResourceType;
  contentType: string;
  bytes: Uint8Array;
  originalFilename?: string;
}

/** What the provider reports back about the asset it just stored. */
export interface CloudinaryUploadResult {
  publicId: string;
  resourceType: AssetResourceType;
  format?: string;
  bytes: number;
}

export interface CloudinaryUploadPort {
  /** Signs the canonical upload parameters with the account's API secret. */
  signParams(params: Readonly<Record<string, string | number>>): string;
  /** Uploads bytes the API generated and returns the provider's own view of the asset. */
  upload(request: CloudinaryUploadRequest): Promise<CloudinaryUploadResult>;
  /** Deletes the asset. Idempotent — deleting an already-deleted asset is not an error. */
  destroy(locator: CloudinaryAssetLocator): Promise<void>;
}

export interface CloudinaryDeliveryRequest extends CloudinaryAssetLocator {
  /** Raw assets need their extension on the URL to be served with the right type. */
  format?: string;
  transformation?: TransformationPreset;
  /** Unix seconds after which the provider must refuse the link. */
  expiresAtEpochSeconds: number;
  /** Serve as an attachment (a download) rather than rendering inline. */
  attachment: boolean;
}

export interface CloudinaryDeliveryPort {
  /** Builds a signed, expiring delivery URL for a stored asset. */
  signedUrl(request: CloudinaryDeliveryRequest): string;
}

export interface CloudinaryPorts {
  uploads: CloudinaryUploadPort;
  delivery: CloudinaryDeliveryPort;
}
