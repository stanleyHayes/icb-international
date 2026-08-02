/** AES-256-GCM field encryption parameters (§11: PAN and national IDs at rest). */
export const FIELD_CRYPTO_ALGORITHM = 'aes-256-gcm';
export const IV_BYTES = 12;
export const AUTH_TAG_BYTES = 16;
export const KEY_BYTES = 32;

/**
 * Payload layout: `v1.<iv>.<authTag>.<ciphertext>`, each binary segment base64url.
 * The version prefix allows algorithm rotation without a flag day.
 */
export const PAYLOAD_VERSION = 'v1';
export const PAYLOAD_SEGMENTS = 4;
