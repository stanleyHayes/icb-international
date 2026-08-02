import { createHash } from 'node:crypto';

import {
  CLOUDINARY_DELIVERY_TYPE,
  CLOUDINARY_UPLOAD_ACTION,
  CLOUDINARY_UPLOAD_BASE_URL,
  MILLIS_PER_SECOND,
} from './media.constants.js';
import type { AssetResourceType, DocumentKind } from './document-kind.js';

/** What a caller asks for when minting a direct-upload signature. */
export interface MintUploadInput {
  kind: DocumentKind;
  /** Scopes the asset's folder — typically a customer, dispute, or account id. */
  ownerId: string;
  contentType: string;
  sizeBytes: number;
  /** Human-meaningful prefix for the public id, e.g. `passport` or `dispute-letter`. */
  label?: string;
}

/**
 * A signed direct-upload grant. The browser posts bytes straight to `uploadUrl` with these
 * fields; the API never buffers the file.
 *
 * The first seven fields are exactly the `uploadSignature` contract. `type` is carried as well
 * because the delivery type is part of the signed payload — a client that omitted it would have
 * its upload rejected, and an upload that defaulted to `upload` would be world-readable.
 */
export interface SignedUpload {
  uploadUrl: string;
  publicId: string;
  folder: string;
  timestamp: number;
  signature: string;
  apiKey: string;
  expiresAt: string;
  type: string;
}

/**
 * The parameters covered by an upload signature, keyed by their wire names. `public_id` is
 * snake_case on the wire, and the signature must be computed over the wire names.
 */
export function canonicalUploadParams(
  folder: string,
  publicId: string,
  timestamp: number,
): Record<string, string | number> {
  return { folder, public_id: publicId, timestamp, type: CLOUDINARY_DELIVERY_TYPE };
}

/** Direct-upload endpoint for a cloud and resource type. */
export function uploadEndpoint(cloudName: string, resourceType: AssetResourceType): string {
  return `${CLOUDINARY_UPLOAD_BASE_URL}/${cloudName}/${resourceType}/${CLOUDINARY_UPLOAD_ACTION}`;
}

/**
 * The provider's signing scheme, reimplemented for the local store: signed parameters
 * sorted by name, joined as a query string, API secret appended, SHA-1 hex. Byte-order
 * sort, not locale order — the provider sorts on raw parameter names.
 */
export function signUploadParamsSha1(
  params: Readonly<Record<string, string | number>>,
  secret: string,
): string {
  const canonical = Object.entries(params)
    .map(([key, value]) => `${key}=${String(value)}`)
    .sort((left, right) => (left < right ? -1 : 1))
    .join('&');
  // eslint-disable-next-line sonarjs/hashing -- dictated by the provider's signature scheme
  return createHash('sha1').update(`${canonical}${secret}`).digest('hex');
}

export function epochSeconds(epochMs: number): number {
  return Math.floor(epochMs / MILLIS_PER_SECOND);
}

export function isoAfter(epochMs: number, ttlSeconds: number): string {
  return new Date(epochMs + ttlSeconds * MILLIS_PER_SECOND).toISOString();
}
