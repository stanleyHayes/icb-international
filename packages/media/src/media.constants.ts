import type { DocumentKind } from './document-kind.js';
import type { TransformationPreset, TransformationPresetName } from './transformation.js';

/** How long a minted upload signature stays usable, unless overridden. */
export const DEFAULT_UPLOAD_SIGNATURE_TTL_SECONDS = 300;
/** How long a signed delivery link is treated as valid by the issuing service. */
export const DEFAULT_DELIVERY_URL_TTL_SECONDS = 300;

export const CLOUDINARY_UPLOAD_BASE_URL = 'https://api.cloudinary.com/v1_1';
export const CLOUDINARY_UPLOAD_ACTION = 'upload';

export const MILLIS_PER_SECOND = 1000;

/** Default folder namespace; mirrors the `CLOUDINARY_FOLDER` default in the API config. */
export const DEFAULT_ROOT_FOLDER = 'icb';

/** The local stand-in has no real credential; this only keeps the wire shape stable. */
export const LOCAL_API_KEY = 'local';
/** Not a security boundary: the local store is for keyless development only. */
export const LOCAL_SIGNING_SECRET = 'icb-local-upload';
export const LOCAL_UPLOAD_PATH = '/v1/media/local-upload';
export const LOCAL_DELIVERY_PATH_PREFIX = '/media';

/**
 * MIME allow-list per document kind. A kind only ever accepts what its domain flow can
 * produce — e.g. a generated statement is always a PDF, an avatar is always an image.
 */
export const ALLOWED_MIME_TYPES: Readonly<Record<DocumentKind, readonly string[]>> = {
  kyc: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  'dispute-evidence': ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
  statements: ['application/pdf'],
  avatars: ['image/jpeg', 'image/png', 'image/webp'],
  marketing: ['image/jpeg', 'image/png', 'image/webp'],
};

/** Upload size ceiling per document kind, in bytes. */
export const MAX_UPLOAD_BYTES: Readonly<Record<DocumentKind, number>> = {
  kyc: 10 * 1024 * 1024,
  'dispute-evidence': 10 * 1024 * 1024,
  statements: 5 * 1024 * 1024,
  avatars: 2 * 1024 * 1024,
  marketing: 5 * 1024 * 1024,
};

/** File extension used when persisting bytes for a MIME type (local store). */
export const MIME_TYPE_EXTENSIONS: Readonly<Record<string, string>> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
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
