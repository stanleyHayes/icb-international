import { AssetTooLargeError, UnsupportedMediaTypeError } from './errors.js';
import {
  ALLOWED_MIME_TYPES_BY_KIND,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_BYTES_BY_KIND,
  PDF_MIME_TYPE,
} from './media.constants.js';
import type { AssetResourceType, DocumentKind } from './document-kind.js';

export interface UploadConstraints {
  kind: DocumentKind;
  contentType: string;
  sizeBytes: number;
}

export function isAllowedMimeType(kind: DocumentKind, contentType: string): boolean {
  return ALLOWED_MIME_TYPES_BY_KIND[kind].includes(contentType);
}

/** The tighter of the kind's own ceiling and the bank-wide 15 MB cap. */
export function maxUploadBytes(kind: DocumentKind): number {
  return Math.min(MAX_UPLOAD_BYTES_BY_KIND[kind], MAX_UPLOAD_BYTES);
}

/**
 * Enforces the MIME + size allow-lists before a signature is minted. Checking here — before
 * the browser ever uploads — means a rejected file costs the user nothing and the provider
 * never sees bytes we would have to delete.
 */
export function assertUploadAllowed(constraints: UploadConstraints): void {
  const { kind, contentType, sizeBytes } = constraints;
  if (!isAllowedMimeType(kind, contentType)) {
    throw new UnsupportedMediaTypeError(kind, contentType);
  }
  const maxBytes = maxUploadBytes(kind);
  if (sizeBytes > maxBytes) {
    throw new AssetTooLargeError(kind, sizeBytes, maxBytes);
  }
}

/**
 * PDFs are stored as raw assets; everything else in the allow-lists is an image the
 * provider may transform. There is no video kind today.
 */
export function resourceTypeFor(contentType: string): AssetResourceType {
  return contentType === PDF_MIME_TYPE ? 'raw' : 'image';
}
