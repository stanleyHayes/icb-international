import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';

import { DomainError } from '../../../common/errors/index.js';

/**
 * Field-level encryption for card secrets.
 *
 * A PAN is the one value in this system that is worth stealing on its own, so it is never stored
 * in the clear: it is sealed with AES-256-GCM under `config.crypto.fieldEncryptionKey` and only
 * ever opened behind step-up authentication. GCM rather than CBC because the authentication tag
 * makes a tampered ciphertext fail loudly instead of decrypting to garbage that later gets
 * charged to somebody.
 *
 * A fresh random IV per encryption is what keeps two identical PANs from producing identical
 * ciphertext — without it, an attacker with read access could tell which cards share a number.
 * Because of that, equality lookups use `fingerprint()` (a keyed HMAC), never the ciphertext.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_BYTES = 32;
const SEPARATOR = '.';
const ENCODING = 'base64url';

function toKey(keyHex: string): Buffer {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== KEY_BYTES) {
    throw new DomainError('INTERNAL_ERROR', 'The field encryption key must be 32 bytes of hex');
  }
  return key;
}

/** Seal a secret. Returns `iv.ciphertext.tag`, each part base64url — safe in JSON and in a URL. */
export function encryptField(plaintext: string, keyHex: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, toKey(keyHex), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

  return [iv, ciphertext, cipher.getAuthTag()]
    .map((part) => part.toString(ENCODING))
    .join(SEPARATOR);
}

/** Open a sealed secret. Throws rather than returning a partial value if the tag does not verify. */
export function decryptField(payload: string, keyHex: string): string {
  const [ivPart, cipherPart, tagPart] = payload.split(SEPARATOR);

  if (!ivPart || !cipherPart || !tagPart) {
    throw new DomainError('INTERNAL_ERROR', 'Stored card data is not in the expected format');
  }

  try {
    const decipher = createDecipheriv(ALGORITHM, toKey(keyHex), Buffer.from(ivPart, ENCODING));
    decipher.setAuthTag(Buffer.from(tagPart, ENCODING));
    return Buffer.concat([
      decipher.update(Buffer.from(cipherPart, ENCODING)),
      decipher.final(),
    ]).toString('utf8');
  } catch (cause) {
    throw new DomainError('INTERNAL_ERROR', 'Stored card data could not be decrypted', { cause });
  }
}

/**
 * A deterministic, keyed digest of a value.
 *
 * Used to enforce "no two live cards share a PAN" without ever indexing the PAN itself. Keyed
 * (HMAC) rather than a plain hash because the search space of a 16-digit number is small enough
 * to brute-force an unkeyed digest in minutes.
 */
export function fingerprint(value: string, keyHex: string): string {
  return createHmac('sha256', toKey(keyHex)).update(value).digest('hex');
}
