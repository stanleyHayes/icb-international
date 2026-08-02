import { randomUUID } from 'node:crypto';

import { assertUploadAllowed, resourceTypeFor } from './allow-list.js';
import { assertAssetRef, type AssetRef } from './asset-ref.js';
import type { AssetStore, DeliveryOptions, SignedDelivery, StoreDeps } from './asset-store.js';
import { assetFolder, buildPublicId } from './document-kind.js';
import { TransformationNotSupportedError } from './errors.js';
import {
  DEFAULT_DELIVERY_URL_TTL_SECONDS,
  DEFAULT_UPLOAD_SIGNATURE_TTL_SECONDS,
} from './media.constants.js';
import type { CloudinaryPorts } from './ports.js';
import { transformationPreset, type TransformationPreset } from './transformation.js';
import type { TransformationPresetName } from './transformation.js';
import type { MintUploadInput, SignedUpload } from './upload-signature.js';
import {
  canonicalUploadParams,
  epochSeconds,
  isoAfter,
  uploadEndpoint,
} from './upload-signature.js';

export interface CloudinaryStoreConfig {
  cloudName: string;
  apiKey: string;
  /** Folder namespace for every asset, e.g. `icb` or `icb-staging`. */
  rootFolder: string;
  uploadSignatureTtlSeconds?: number;
  deliveryUrlTtlSeconds?: number;
}

/**
 * Cloudinary-backed asset store. All provider contact goes through the injected ports, so
 * this class holds the package's policy (conventions, allow-lists, TTLs) and none of the
 * provider's client types.
 */
export class CloudinaryAssetStore implements AssetStore {
  private readonly now: () => number;
  private readonly generateId: () => string;

  constructor(
    private readonly config: CloudinaryStoreConfig,
    private readonly ports: CloudinaryPorts,
    deps: StoreDeps = {},
  ) {
    this.now = deps.now ?? Date.now;
    this.generateId = deps.generateId ?? randomUUID;
  }

  mintUploadSignature(input: MintUploadInput): SignedUpload {
    assertUploadAllowed(input);

    const folder = assetFolder(this.config.rootFolder, input.kind, input.ownerId);
    const publicId = buildPublicId(input.label ?? input.kind, this.generateId());
    const timestamp = epochSeconds(this.now());
    const ttl = this.config.uploadSignatureTtlSeconds ?? DEFAULT_UPLOAD_SIGNATURE_TTL_SECONDS;

    return {
      uploadUrl: uploadEndpoint(this.config.cloudName, resourceTypeFor(input.contentType)),
      publicId,
      folder,
      timestamp,
      signature: this.ports.uploads.signParams(canonicalUploadParams(folder, publicId, timestamp)),
      apiKey: this.config.apiKey,
      expiresAt: isoAfter(this.now(), ttl),
    };
  }

  signedDeliveryUrl(ref: AssetRef, options: DeliveryOptions = {}): SignedDelivery {
    const asset = assertAssetRef(ref);
    const ttl = options.expiresInSeconds ?? this.config.deliveryUrlTtlSeconds ??
      DEFAULT_DELIVERY_URL_TTL_SECONDS;

    return {
      url: this.ports.delivery.signedUrl({
        publicId: asset.publicId,
        resourceType: asset.resourceType,
        ...(asset.format !== undefined ? { format: asset.format } : {}),
        ...(options.preset !== undefined
          ? { transformation: this.presetFor(asset, options.preset) }
          : {}),
      }),
      expiresAt: isoAfter(this.now(), ttl),
    };
  }

  /** Raw assets (PDFs) are delivered as stored; the provider cannot transform them. */
  private presetFor(asset: AssetRef, preset: TransformationPresetName): TransformationPreset {
    if (asset.resourceType !== 'image') {
      throw new TransformationNotSupportedError(asset.resourceType, preset);
    }
    return transformationPreset(preset);
  }
}
