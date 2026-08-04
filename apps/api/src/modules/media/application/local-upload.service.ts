import {
  ALLOWED_MIME_TYPES,
  AssetTooLargeError,
  DOCUMENT_KINDS,
  LocalAssetStore,
  MAX_UPLOAD_BYTES,
  MediaError,
  UnsupportedMediaTypeError,
  assertUploadAllowed,
  canonicalUploadParams,
  signUploadParamsSha1,
  type AssetRef,
  type AssetStore,
  type DocumentKind,
  type LocalUpload,
} from '@icb/media';
import { Inject, Injectable } from '@nestjs/common';

import { NotFoundError, ValidationError } from '../../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { ASSET_STORE } from '../../documents/infrastructure/asset-store.provider.js';
import { sniffMimeType } from './mime-sniffer.js';

/** Mirrors the kyc/support minters: the local stand-in has no real credential. */
const LOCAL_API_KEY = 'local';
/** Not a security boundary: the local store is for keyless development only. */
const LOCAL_SIGNING_SECRET = 'icb-local-upload';

/** The multipart fields a minted upload grant arrives with (Cloudinary's wire names). */
export interface LocalUploadGrant {
  apiKey: string;
  folder: string;
  publicId: string;
  timestamp: number;
  signature: string;
}

export interface LocalUploadFile {
  contentType: string;
  originalFilename: string;
  bytes: Uint8Array;
}

/** The Cloudinary-shaped answer the upload widgets already know how to read. */
export interface LocalUploadResponse {
  public_id: string;
  resource_type: string;
  format?: string;
  bytes?: number;
  original_filename?: string;
}

const MILLIS_PER_SECOND = 1000;
const KIND_SEGMENT_INDEX = 1;

/**
 * The keyless-development upload target.
 *
 * When no storage credentials are configured, the KYC and support flows mint signatures whose
 * upload URL points here instead of at Cloudinary. This service plays the provider's part: it
 * checks the grant the same way (SHA-1 over the signed parameters), applies the same MIME and
 * size allow-lists, persists through the local store, and answers in the provider's response
 * shape — so swapping credentials in later changes nothing above it. The signature is not a
 * security boundary (the secret is a well-known constant); it keeps the dev flow honest.
 */
@Injectable()
export class LocalUploadService {
  constructor(
    @Inject(ASSET_STORE) private readonly assets: AssetStore,
    @Inject(CONFIG) private readonly config: AppConfiguration,
    private readonly clock: ClockService,
  ) {}

  async accept(grant: LocalUploadGrant, file: LocalUploadFile): Promise<LocalUploadResponse> {
    const store = this.localStore();
    this.assertGrantValid(grant);
    this.assertAllowed(grant.folder, file);
    this.assertContentMatchesType(file);

    const upload: LocalUpload = {
      folder: grant.folder,
      publicId: grant.publicId,
      contentType: file.contentType,
      bytes: file.bytes,
      originalFilename: file.originalFilename,
    };
    try {
      return toResponse(await store.save(upload));
    } catch (error) {
      if (error instanceof MediaError) throw new ValidationError(error.message);
      throw error;
    }
  }

  /** This endpoint only exists in the local configuration — with credentials, the provider answers. */
  private localStore(): LocalAssetStore {
    if (!(this.assets instanceof LocalAssetStore)) {
      throw new NotFoundError('Endpoint', '/v1/media/local-upload');
    }
    return this.assets;
  }

  /** The grant must name the local key, be unexpired, and be signed by the scheme that minted it. */
  private assertGrantValid(grant: LocalUploadGrant): void {
    if (grant.apiKey !== LOCAL_API_KEY) {
      throw new ValidationError('The upload grant does not belong to this storage provider');
    }
    const nowSeconds = Math.floor(this.clock.epochMs() / MILLIS_PER_SECOND);
    if (grant.timestamp + this.config.media.signedUrlTtlSeconds < nowSeconds) {
      throw new ValidationError('The upload grant has expired. Mint a new one and retry.');
    }
    if (!this.signatureMatches(grant)) {
      throw new ValidationError('The upload grant signature does not match its parameters');
    }
  }

  /** Both minting schemes are accepted: with the delivery `type` (support) and without (kyc). */
  private signatureMatches(grant: LocalUploadGrant): boolean {
    const secret =
      this.config.media.apiSecret.length > 0 ? this.config.media.apiSecret : LOCAL_SIGNING_SECRET;
    const candidates = [
      { folder: grant.folder, public_id: grant.publicId, timestamp: grant.timestamp },
      canonicalUploadParams(grant.folder, grant.publicId, grant.timestamp),
    ];
    return candidates.some((params) => signUploadParamsSha1(params, secret) === grant.signature);
  }

  /** MIME and size allow-lists — the same ones the signature minter enforced. */
  private assertAllowed(folder: string, file: LocalUploadFile): void {
    try {
      const kind = kindFromFolder(folder);
      if (kind !== null) {
        assertUploadAllowed({ kind, contentType: file.contentType, sizeBytes: file.bytes.byteLength });
      } else {
        assertGloballyAllowed(folder, file);
      }
    } catch (error) {
      if (error instanceof MediaError) throw new ValidationError(error.message);
      throw error;
    }
  }

  /**
   * The declared content-type is client input and proves nothing, so the bytes must back it up:
   * the magic-byte signature has to match the declared type exactly. A PDF renamed to `.png` —
   * or anything with no recognised signature at all — is refused before it is persisted.
   */
  private assertContentMatchesType(file: LocalUploadFile): void {
    if (sniffMimeType(file.bytes) !== file.contentType) {
      throw new ValidationError('The file content does not match its declared type', [
        { path: 'file', message: 'The file bytes are not what the content-type claims' },
      ]);
    }
  }
}

/** The folder convention is `<root>/<kind>/<ownerId>`; unknown kinds get the global allow-list. */
function kindFromFolder(folder: string): DocumentKind | null {
  const segment = folder.split('/')[KIND_SEGMENT_INDEX] ?? '';
  return (DOCUMENT_KINDS as readonly string[]).includes(segment) ? (segment as DocumentKind) : null;
}

/** Folders outside the kind conventions (e.g. support attachments) fall back to the global caps. */
function assertGloballyAllowed(folder: string, file: LocalUploadFile): void {
  const label = folder.split('/')[KIND_SEGMENT_INDEX] ?? 'unknown';
  if (!ALLOWED_MIME_TYPES.includes(file.contentType)) {
    throw new UnsupportedMediaTypeError(label, file.contentType);
  }
  if (file.bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new AssetTooLargeError(label, file.bytes.byteLength, MAX_UPLOAD_BYTES);
  }
}

/** The provider's response shape — the upload widgets read these snake_case fields. */
function toResponse(ref: AssetRef): LocalUploadResponse {
  return {
    public_id: ref.publicId,
    resource_type: ref.resourceType,
    ...(ref.format !== undefined ? { format: ref.format } : {}),
    ...(ref.bytes !== undefined ? { bytes: ref.bytes } : {}),
    ...(ref.originalFilename !== undefined ? { original_filename: ref.originalFilename } : {}),
  };
}
