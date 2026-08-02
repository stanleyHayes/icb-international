import { v2 as cloudinary } from 'cloudinary';

import { CloudinaryAssetStore, type CloudinaryStoreConfig } from './cloudinary-store.js';
import type { StoreDeps } from './asset-store.js';
import type { AssetResourceType } from './document-kind.js';
import { CLOUDINARY_DELIVERY_TYPE } from './media.constants.js';
import type {
  CloudinaryAssetLocator,
  CloudinaryDeliveryRequest,
  CloudinaryPorts,
  CloudinaryUploadRequest,
  CloudinaryUploadResult,
} from './ports.js';
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
      upload: (request) => uploadAsset(request),
      destroy: (locator) => destroyAsset(locator),
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
 * Server-side upload. The bytes are handed over as a data URI, which is the client's
 * documented way to upload an in-memory buffer without first writing it to disk — a rendered
 * statement never touches the filesystem of the API host.
 *
 * `overwrite: false` matters: a public id is only ever minted once, and silently replacing an
 * asset a statement already points at would rewrite history.
 */
async function uploadAsset(request: CloudinaryUploadRequest): Promise<CloudinaryUploadResult> {
  const payload = `data:${request.contentType};base64,${Buffer.from(request.bytes).toString('base64')}`;

  const response = await cloudinary.uploader.upload(payload, {
    folder: request.folder,
    public_id: request.publicId,
    resource_type: request.resourceType,
    type: CLOUDINARY_DELIVERY_TYPE,
    overwrite: false,
    unique_filename: false,
    use_filename: false,
    ...(request.originalFilename === undefined
      ? {}
      : { filename_override: request.originalFilename }),
  });

  return {
    publicId: response.public_id,
    resourceType: narrowResourceType(response.resource_type, request.resourceType),
    bytes: response.bytes,
    ...(typeof response.format === 'string' && response.format.length > 0
      ? { format: response.format }
      : {}),
  };
}

/** `invalidate` purges the CDN too, so a deleted document stops being served immediately. */
async function destroyAsset(locator: CloudinaryAssetLocator): Promise<void> {
  await cloudinary.uploader.destroy(locator.publicId, {
    resource_type: locator.resourceType,
    type: CLOUDINARY_DELIVERY_TYPE,
    invalidate: true,
  });
}

/**
 * Two provider mechanisms, chosen by what the link is for.
 *
 * A download goes through `private_download_url`: it is the one Cloudinary endpoint that
 * *enforces* `expires_at` server-side, so a leaked statement link is dead once the window
 * closes. An inline render goes through `cloudinary.url` with `sign_url`, which is the only
 * way to attach a transformation, and is signed so the path cannot be edited to reach another
 * asset. Both address `authenticated` assets, which are never served unsigned.
 */
function deliveryUrl(request: CloudinaryDeliveryRequest): string {
  return request.attachment ? expiringDownloadUrl(request) : signedRenderUrl(request);
}

function expiringDownloadUrl(request: CloudinaryDeliveryRequest): string {
  return cloudinary.utils.private_download_url(request.publicId, request.format ?? '', {
    resource_type: request.resourceType,
    type: CLOUDINARY_DELIVERY_TYPE,
    expires_at: request.expiresAtEpochSeconds,
    attachment: true,
  });
}

function signedRenderUrl(request: CloudinaryDeliveryRequest): string {
  return cloudinary.url(request.publicId, {
    resource_type: request.resourceType,
    type: CLOUDINARY_DELIVERY_TYPE,
    secure: true,
    sign_url: true,
    expires_at: request.expiresAtEpochSeconds,
    ...(request.format === undefined ? {} : { format: request.format }),
    ...(request.transformation === undefined
      ? {}
      : { transformation: toCloudinaryTransformation(request.transformation) }),
  });
}

/** The provider may answer `auto`; the asset's own resource type is the authoritative answer. */
function narrowResourceType(reported: string, requested: AssetResourceType): AssetResourceType {
  if (reported === 'image' || reported === 'raw' || reported === 'video') {
    return reported;
  }
  return requested;
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
