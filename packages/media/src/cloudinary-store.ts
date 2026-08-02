import { randomUUID } from 'node:crypto';

import { assertUploadAllowed, resourceTypeFor } from './allow-list.js';
import { assertAssetRef, buildAssetRef, type AssetRef } from './asset-ref.js';
import type {
  AssetStore,
  AssetUpload,
  DeliveryOptions,
  SignedDelivery,
  StoreDeps,
} from './asset-store.js';
import { assetFolder, buildPublicId } from './document-kind.js';
import { TransformationNotSupportedError } from './errors.js';
import {
  CLOUDINARY_DELIVERY_TYPE,
  DEFAULT_DELIVERY_URL_TTL_SECONDS,
  DEFAULT_UPLOAD_SIGNATURE_TTL_SECONDS,
} from './media.constants.js';
import type { CloudinaryPorts } from './ports.js';
import {
  transformationPreset,
  type TransformationPreset,
  type TransformationPresetName,
} from './transformation.js';
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

/** Where an asset will live, derived from the conventions rather than from caller input. */
interface AssetTarget {
  folder: string;
  publicId: string;
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

    const { folder, publicId } = this.resolveTarget(input.kind, input.ownerId, input.label);
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
      type: CLOUDINARY_DELIVERY_TYPE,
    };
  }

  /**
   * Uploads bytes the API rendered itself. The allow-list is applied to the real byte length,
   * so a generated document is held to the same ceiling as one a customer supplies.
   */
  async upload(input: AssetUpload): Promise<AssetRef> {
    assertUploadAllowed({
      kind: input.kind,
      contentType: input.contentType,
      sizeBytes: input.bytes.byteLength,
    });

    const target = this.resolveTarget(input.kind, input.ownerId, input.label);
    const result = await this.ports.uploads.upload({
      folder: target.folder,
      publicId: target.publicId,
      resourceType: resourceTypeFor(input.contentType),
      contentType: input.contentType,
      bytes: input.bytes,
      ...(input.originalFilename === undefined
        ? {}
        : { originalFilename: input.originalFilename }),
    });

    return buildAssetRef({
      publicId: result.publicId,
      resourceType: result.resourceType,
      bytes: result.bytes,
      uploadedAt: new Date(this.now()).toISOString(),
      ...(result.format === undefined ? {} : { format: result.format }),
      ...(input.originalFilename === undefined
        ? {}
        : { originalFilename: input.originalFilename }),
    });
  }

  buildSignedUrl(
    ref: AssetRef,
    ttlSeconds?: number,
    options: DeliveryOptions = {},
  ): SignedDelivery {
    const asset = assertAssetRef(ref);
    const ttl =
      ttlSeconds ?? this.config.deliveryUrlTtlSeconds ?? DEFAULT_DELIVERY_URL_TTL_SECONDS;
    const issuedAtMs = this.now();

    return {
      url: this.ports.delivery.signedUrl({
        publicId: asset.publicId,
        resourceType: asset.resourceType,
        expiresAtEpochSeconds: epochSeconds(issuedAtMs) + ttl,
        attachment: options.download === true,
        ...(asset.format === undefined ? {} : { format: asset.format }),
        ...(options.preset === undefined
          ? {}
          : { transformation: this.presetFor(asset, options.preset) }),
      }),
      expiresAt: isoAfter(issuedAtMs, ttl),
    };
  }

  async destroy(ref: AssetRef): Promise<void> {
    const asset = assertAssetRef(ref);
    await this.ports.uploads.destroy({
      publicId: asset.publicId,
      resourceType: asset.resourceType,
    });
  }

  private resolveTarget(
    kind: MintUploadInput['kind'],
    ownerId: string,
    label: string | undefined,
  ): AssetTarget {
    return {
      folder: assetFolder(this.config.rootFolder, kind, ownerId),
      publicId: buildPublicId(label ?? kind, this.generateId()),
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
