import { randomUUID, createHmac } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

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
import { UnsafeAssetPathError } from './errors.js';
import {
  CLOUDINARY_DELIVERY_TYPE,
  DEFAULT_DELIVERY_URL_TTL_SECONDS,
  DEFAULT_ROOT_FOLDER,
  DEFAULT_UPLOAD_SIGNATURE_TTL_SECONDS,
  LOCAL_API_KEY,
  LOCAL_DELIVERY_PATH_PREFIX,
  LOCAL_SIGNING_SECRET,
  LOCAL_UPLOAD_PATH,
  MIME_TYPE_EXTENSIONS,
} from './media.constants.js';
import type { MintUploadInput, SignedUpload } from './upload-signature.js';
import {
  canonicalUploadParams,
  epochSeconds,
  isoAfter,
  signUploadParamsSha1,
} from './upload-signature.js';

export interface LocalAssetStoreConfig {
  /** Directory the store persists uploads under, e.g. `<repo>/storage`. */
  rootDir: string;
  /** Origin the API is reachable at, e.g. `http://localhost:3001`. */
  baseUrl: string;
  /** Folder namespace for every asset; mirrors the Cloudinary store's `rootFolder`. */
  rootFolder?: string;
  uploadPath?: string;
  deliveryPathPrefix?: string;
  /** Dev-only HMAC secret for local delivery links. */
  signingSecret?: string;
  uploadSignatureTtlSeconds?: number;
  deliveryUrlTtlSeconds?: number;
}

/** Bytes the browser posted to the local upload endpoint, keyed by the minted grant. */
export interface LocalUpload {
  folder: string;
  publicId: string;
  contentType: string;
  bytes: Uint8Array;
  originalFilename?: string;
}

const SAFE_PATH_SEGMENT = /^[a-z0-9][a-z0-9_-]*$/i;
const DOWNLOAD_QUERY_FLAG = '&dl=1';

/**
 * Keyless-development stand-in for Cloudinary. Implements the same `AssetStore` port against
 * the filesystem, and the asset refs it produces satisfy the contract's `assetRefSchema`
 * (`provider: 'cloudinary'`) because the store emulates Cloudinary — swapping in real
 * credentials changes nothing downstream.
 */
export class LocalAssetStore implements AssetStore {
  private readonly now: () => number;
  private readonly generateId: () => string;

  constructor(
    private readonly config: LocalAssetStoreConfig,
    deps: StoreDeps = {},
  ) {
    this.now = deps.now ?? Date.now;
    this.generateId = deps.generateId ?? randomUUID;
  }

  mintUploadSignature(input: MintUploadInput): SignedUpload {
    assertUploadAllowed(input);

    const folder = assetFolder(this.rootFolder(), input.kind, input.ownerId);
    const publicId = buildPublicId(input.label ?? input.kind, this.generateId());
    const timestamp = epochSeconds(this.now());
    const ttl = this.config.uploadSignatureTtlSeconds ?? DEFAULT_UPLOAD_SIGNATURE_TTL_SECONDS;

    return {
      uploadUrl: `${this.config.baseUrl}${this.config.uploadPath ?? LOCAL_UPLOAD_PATH}`,
      publicId,
      folder,
      timestamp,
      signature: signUploadParamsSha1(
        canonicalUploadParams(folder, publicId, timestamp),
        this.signingSecret(),
      ),
      apiKey: LOCAL_API_KEY,
      expiresAt: isoAfter(this.now(), ttl),
      type: CLOUDINARY_DELIVERY_TYPE,
    };
  }

  /** Server-side upload of bytes the API generated (a rendered statement, a letter). */
  async upload(input: AssetUpload): Promise<AssetRef> {
    assertUploadAllowed({
      kind: input.kind,
      contentType: input.contentType,
      sizeBytes: input.bytes.byteLength,
    });

    const folder = assetFolder(this.rootFolder(), input.kind, input.ownerId);
    const publicId = buildPublicId(input.label ?? input.kind, this.generateId());
    return this.persist({ folder, publicId, ...input });
  }

  /** Persists bytes the browser posted to the local upload endpoint. */
  async save(upload: LocalUpload): Promise<AssetRef> {
    return this.persist(upload);
  }

  /**
   * A signed local link: the delivery server checks `exp` against the HMAC. Unlike the
   * provider's render signature, this one genuinely expires — which is what a dev flow needs.
   */
  buildSignedUrl(ref: AssetRef, ttlSeconds?: number, options: DeliveryOptions = {}): SignedDelivery {
    const ttl = ttlSeconds ?? this.config.deliveryUrlTtlSeconds ?? DEFAULT_DELIVERY_URL_TTL_SECONDS;
    const exp = epochSeconds(this.now()) + ttl;
    const prefix = this.config.deliveryPathPrefix ?? LOCAL_DELIVERY_PATH_PREFIX;
    const path = withExtension(ref.publicId, ref.format);
    const signature = this.signDelivery(path, exp);
    const downloadFlag = options.download === true ? DOWNLOAD_QUERY_FLAG : '';

    return {
      url: `${this.config.baseUrl}${prefix}/${path}?exp=${String(exp)}&sig=${signature}${downloadFlag}`,
      expiresAt: isoAfter(this.now(), ttl),
    };
  }

  /** Removes the persisted bytes. Idempotent, like the provider's destroy. */
  async destroy(ref: AssetRef): Promise<void> {
    const asset = assertAssetRef(ref);
    assertSafeSegment(asset.publicId);
    await rm(join(this.config.rootDir, withExtension(asset.publicId, asset.format)), {
      force: true,
    });
  }

  /** Recomputes the delivery HMAC; the local delivery handler compares against `sig`. */
  verifyDeliverySignature(path: string, exp: number, signature: string): boolean {
    return this.signDelivery(path, exp) === signature;
  }

  private async persist(upload: LocalUpload): Promise<AssetRef> {
    assertSafeSegment(upload.folder);
    assertSafeSegment(upload.publicId);

    const format = MIME_TYPE_EXTENSIONS[upload.contentType];
    const publicId = `${upload.folder}/${upload.publicId}`;
    await mkdir(join(this.config.rootDir, upload.folder), { recursive: true });
    await writeFile(join(this.config.rootDir, withExtension(publicId, format)), upload.bytes);

    return buildAssetRef({
      publicId,
      resourceType: resourceTypeFor(upload.contentType),
      uploadedAt: new Date(this.now()).toISOString(),
      ...(format !== undefined ? { format } : {}),
      bytes: upload.bytes.byteLength,
      ...(upload.originalFilename !== undefined
        ? { originalFilename: upload.originalFilename }
        : {}),
    });
  }

  private signDelivery(path: string, exp: number): string {
    return createHmac('sha256', this.signingSecret())
      .update(`${path}.${String(exp)}`)
      .digest('hex');
  }

  private rootFolder(): string {
    return this.config.rootFolder ?? DEFAULT_ROOT_FOLDER;
  }

  private signingSecret(): string {
    return this.config.signingSecret ?? LOCAL_SIGNING_SECRET;
  }
}

function assertSafeSegment(segment: string): void {
  const parts = segment.split('/');
  if (parts.some((part) => !SAFE_PATH_SEGMENT.test(part))) {
    throw new UnsafeAssetPathError(segment);
  }
}

function withExtension(publicId: string, format: string | undefined): string {
  return format !== undefined ? `${publicId}.${format}` : publicId;
}
