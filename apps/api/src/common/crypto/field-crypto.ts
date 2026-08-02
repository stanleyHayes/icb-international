import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { DecryptionFailedError } from '../errors/domain-errors.js';
import {
  AUTH_TAG_BYTES,
  FIELD_CRYPTO_ALGORITHM,
  IV_BYTES,
  PAYLOAD_SEGMENTS,
  PAYLOAD_VERSION,
} from './field-crypto.constants.js';

/**
 * AES-256-GCM encryption for PII at rest (§11) — PANs, national IDs, dates of birth.
 *
 * GCM gives confidentiality and integrity in one primitive: a tampered or wrong-key ciphertext
 * fails authentication instead of decrypting to garbage. A fresh random IV per call means the
 * same plaintext never produces the same ciphertext, so encrypted columns do not leak equality.
 * The trade-off — no exact-match index on encrypted columns — is deliberate.
 */
export function encryptField(plaintext: string, key: Buffer): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(FIELD_CRYPTO_ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_BYTES,
  });
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [PAYLOAD_VERSION, iv, cipher.getAuthTag(), ciphertext]
    .map((segment) => (Buffer.isBuffer(segment) ? segment.toString('base64url') : segment))
    .join('.');
}

export function decryptField(payload: string, key: Buffer): string {
  const segments = payload.split('.');
  const [version, iv, authTag, ciphertext] = segments;
  if (segments.length !== PAYLOAD_SEGMENTS || version !== PAYLOAD_VERSION || !iv || !authTag || !ciphertext) {
    throw new DecryptionFailedError();
  }
  try {
    const decipher = createDecipheriv(
      FIELD_CRYPTO_ALGORITHM,
      key,
      Buffer.from(iv, 'base64url'),
      { authTagLength: AUTH_TAG_BYTES },
    );
    decipher.setAuthTag(Buffer.from(authTag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString(
      'utf8',
    );
  } catch {
    throw new DecryptionFailedError();
  }
}
