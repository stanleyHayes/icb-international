import type { DocumentKind } from './document-kind.js';
import type { TransformationPreset, TransformationPresetName } from './transformation.js';

/** How long a minted upload signature stays usable, unless overridden. */
export const DEFAULT_UPLOAD_SIGNATURE_TTL_SECONDS = 300;
/** How long a signed delivery link stays valid. Links are minted per request, never stored. */
export const DEFAULT_DELIVERY_URL_TTL_SECONDS = 300;

export const CLOUDINARY_UPLOAD_BASE_URL = 'https://api.cloudinary.com/v1_1';
export const CLOUDINARY_UPLOAD_ACTION = 'upload';

/**
 * Every ICB asset is stored with the `authenticated` delivery type, so the provider refuses to
 * serve it from a guessed URL. There is no public bucket to leak a passport scan from.
 */
export const CLOUDINARY_DELIVERY_TYPE = 'authenticated';

export const MILLIS_PER_SECOND = 1000;

/** Default folder namespace; mirrors the `CLOUDINARY_FOLDER` default in the API config. */
export const DEFAULT_ROOT_FOLDER = 'icb';

/** The local stand-in has no real credential; this only keeps the wire shape stable. */
export const LOCAL_API_KEY = 'local';
/** Not a security boundary: the local store is for keyless development only. */
export const LOCAL_SIGNING_SECRET = 'icb-local-upload';
export const LOCAL_UPLOAD_PATH = '/v1/media/local-upload';
export const LOCAL_DELIVERY_PATH_PREFIX = '/media';

const JPEG_MIME_TYPE = 'image/jpeg';
const PNG_MIME_TYPE = 'image/png';
const WEBP_MIME_TYPE = 'image/webp';
export const PDF_MIME_TYPE = 'application/pdf';

export const IMAGE_MIME_TYPES: readonly string[] = [
  JPEG_MIME_TYPE,
  PNG_MIME_TYPE,
  WEBP_MIME_TYPE,
];

/** The only media types the bank accepts, anywhere. Anything else is refused before upload. */
export const ALLOWED_MIME_TYPES: readonly string[] = [...IMAGE_MIME_TYPES, PDF_MIME_TYPE];

/** Hard ceiling on any single upload, in bytes. */
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;

/** An avatar has no legitimate reason to be large, so its ceiling is tighter than the global one. */
const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/**
 * MIME allow-list per document kind. A kind only ever accepts what its domain flow can
 * produce — a generated statement is always a PDF, an avatar is always an image.
 */
export const ALLOWED_MIME_TYPES_BY_KIND: Readonly<Record<DocumentKind, readonly string[]>> = {
  kyc: ALLOWED_MIME_TYPES,
  'dispute-evidence': ALLOWED_MIME_TYPES,
  statements: [PDF_MIME_TYPE],
  avatars: IMAGE_MIME_TYPES,
  marketing: IMAGE_MIME_TYPES,
};

/** Upload size ceiling per document kind, in bytes. Never above `MAX_UPLOAD_BYTES`. */
export const MAX_UPLOAD_BYTES_BY_KIND: Readonly<Record<DocumentKind, number>> = {
  kyc: MAX_UPLOAD_BYTES,
  'dispute-evidence': MAX_UPLOAD_BYTES,
  statements: MAX_UPLOAD_BYTES,
  avatars: AVATAR_MAX_BYTES,
  marketing: MAX_UPLOAD_BYTES,
};

/** File extension used when persisting bytes for a MIME type (local store). */
export const MIME_TYPE_EXTENSIONS: Readonly<Record<string, string>> = {
  [JPEG_MIME_TYPE]: 'jpg',
  [PNG_MIME_TYPE]: 'png',
  [WEBP_MIME_TYPE]: 'webp',
  [PDF_MIME_TYPE]: 'pdf',
};

/** Named delivery transformations. Raw assets (PDFs) cannot be transformed. */
export const TRANSFORMATION_PRESETS: Readonly<
  Record<TransformationPresetName, TransformationPreset>
> = {
  'document-thumbnail': {
    width: 300,
    height: 300,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto',
    fetchFormat: 'auto',
  },
  avatar: {
    width: 256,
    height: 256,
    crop: 'fill',
    gravity: 'face',
    quality: 'auto:good',
    fetchFormat: 'auto',
  },
  'marketing-hero': {
    width: 1920,
    height: 1080,
    crop: 'fill',
    gravity: 'auto',
    quality: 'auto:best',
    fetchFormat: 'auto',
  },
};
