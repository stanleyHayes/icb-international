/**
 * Magic-byte MIME sniffing for uploaded files.
 *
 * The declared `content-type` of a multipart part is client-supplied and means nothing: a
 * renamed executable is still an executable. The upload allow-lists only admit JPEG, PNG, WebP
 * and PDF, and all four carry unambiguous signatures, so the bytes themselves are the source of
 * truth. Anything unrecognised returns `null` and the caller refuses the upload.
 */

const JPEG_PREFIX = [0xff, 0xd8, 0xff];
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PDF_PREFIX = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"
const RIFF_PREFIX = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP_TAG_OFFSET = 8;
const WEBP_TAG = [0x57, 0x45, 0x42, 0x50]; // "WEBP", eight bytes into a RIFF header

/** The MIME type the bytes claim to be, or `null` when the signature is not one we accept. */
export function sniffMimeType(bytes: Uint8Array): string | null {
  if (startsWith(bytes, PNG_SIGNATURE)) {
    return 'image/png';
  }
  if (startsWith(bytes, JPEG_PREFIX)) {
    return 'image/jpeg';
  }
  if (startsWith(bytes, PDF_PREFIX)) {
    return 'application/pdf';
  }
  if (startsWith(bytes, RIFF_PREFIX) && startsWith(bytes, WEBP_TAG, WEBP_TAG_OFFSET)) {
    return 'image/webp';
  }
  return null;
}

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  if (bytes.byteLength < offset + signature.length) {
    return false;
  }
  return signature.every((byte, index) => bytes[offset + index] === byte);
}
