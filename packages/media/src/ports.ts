import type { AssetResourceType } from './document-kind.js';
import type { TransformationPreset } from './transformation.js';

/**
 * The port boundary. Everything the package needs from the Cloudinary client is expressed
 * in these two interfaces, in package-owned types only. Unit tests substitute fakes here;
 * `cloudinary-adapter.ts` is the single file that knows the real client exists.
 */
export interface CloudinaryUploadPort {
  /** Signs the canonical upload parameters with the account's API secret. */
  signParams(params: Readonly<Record<string, string | number>>): string;
}

export interface CloudinaryDeliveryRequest {
  publicId: string;
  resourceType: AssetResourceType;
  /** Raw assets need their extension on the URL to be served with the right type. */
  format?: string;
  transformation?: TransformationPreset;
}

export interface CloudinaryDeliveryPort {
  /** Builds a signed, expiring delivery URL for a stored asset. */
  signedUrl(request: CloudinaryDeliveryRequest): string;
}

export interface CloudinaryPorts {
  uploads: CloudinaryUploadPort;
  delivery: CloudinaryDeliveryPort;
}
