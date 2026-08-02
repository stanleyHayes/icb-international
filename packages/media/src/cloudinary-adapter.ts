import { v2 as cloudinary } from 'cloudinary';

import { CloudinaryAssetStore, type CloudinaryStoreConfig } from './cloudinary-store.js';
import type { StoreDeps } from './asset-store.js';
import type { CloudinaryDeliveryRequest, CloudinaryPorts } from './ports.js';
import type { TransformationPreset } from './transformation.js';

export interface CloudinaryCredentials {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * The single point of contact with the Cloudinary client. Everything above this file —
 * and everything exported from the package — speaks only the package's own port types, so
 * no `cloudinary` type can leak into a consumer's compilation.
 */
export function createCloudinaryPorts(credentials: CloudinaryCredentials): CloudinaryPorts {
  cloudinary.config({
    cloud_name: credentials.cloudName,
    api_key: credentials.apiKey,
    api_secret: credentials.apiSecret,
    secure: true,
  });

  return {
    uploads: {
      signParams: (params) =>
        cloudinary.utils.api_sign_request({ ...params }, credentials.apiSecret),
    },
    delivery: {
      signedUrl: (request) => deliveryUrl(request),
    },
  };
}

/** Convenience wiring: credentials in, ready store out. */
export function createCloudinaryAssetStore(
  config: CloudinaryStoreConfig & CloudinaryCredentials,
  deps: StoreDeps = {},
): CloudinaryAssetStore {
  return new CloudinaryAssetStore(config, createCloudinaryPorts(config), deps);
}

/**
 * `sign_url` signs the delivery path with the API secret (the `s--…--` segment), so the
 * URL cannot be altered to reach another asset or transformation. Link expiry is enforced
 * by the issuing service, which re-mints per request instead of persisting URLs.
 */
function deliveryUrl(request: CloudinaryDeliveryRequest): string {
  return cloudinary.url(request.publicId, {
    resource_type: request.resourceType,
    type: 'upload',
    secure: true,
    sign_url: true,
    ...(request.format !== undefined ? { format: request.format } : {}),
    ...(request.transformation !== undefined
      ? { transformation: toCloudinaryTransformation(request.transformation) }
      : {}),
  });
}

/** Maps the provider-neutral preset onto the provider's transformation URL segment. */
function toCloudinaryTransformation(preset: TransformationPreset): Record<string, string | number> {
  return {
    width: preset.width,
    height: preset.height,
    crop: preset.crop,
    gravity: preset.gravity,
    quality: preset.quality,
    fetch_format: preset.fetchFormat,
  };
}
