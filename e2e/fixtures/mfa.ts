import { createDecipheriv, createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { env } from './env';
import { withMongo } from './db';

/**
 * Staff MFA completion.
 *
 * Staff roles are MFA-enrolled by policy, so a seeded staff login answers `mfa_required`
 * with a TOTP challenge. The admin app completes it with the staff member's authenticator;
 * the suite completes it the same way, deriving the current code from the enrolment secret.
 * The secret is held under field-level AES-256-GCM (apps/api/src/common/crypto), so this
 * mirrors that exact construction — same key, same payload layout — and never touches the
 * challenge endpoint itself.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error(`invalid base32 character in TOTP secret: ${char}`);
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** RFC 6238, 30-second step, 6 digits, HMAC-SHA1 — the authenticator defaults otplib uses. */
export function totp(secret: string, forTime = Date.now()): string {
  const counter = Math.floor(forTime / 30_000);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', base32Decode(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary =
    ((digest[offset]! & 0x7f) << 24) |
    (digest[offset + 1]! << 16) |
    (digest[offset + 2]! << 8) |
    digest[offset + 3]!;
  return String(binary % 1_000_000).padStart(6, '0');
}

function fieldEncryptionKey(): Buffer {
  const fromEnv = process.env.E2E_FIELD_ENCRYPTION_KEY;
  if (fromEnv) {
    return Buffer.from(fromEnv, 'hex');
  }
  const envFile = readFileSync(resolve(process.cwd(), '.env'), 'utf8');
  const line = envFile.split('\n').find((entry) => entry.startsWith('FIELD_ENCRYPTION_KEY='));
  if (!line) {
    throw new Error('FIELD_ENCRYPTION_KEY not found in .env — needed to derive staff TOTP');
  }
  return Buffer.from(line.slice('FIELD_ENCRYPTION_KEY='.length).trim(), 'hex');
}

/** Decrypts `v1.<iv>.<authTag>.<ciphertext>` exactly as field-crypto.ts laid it out. */
function decryptField(payload: string, key: Buffer): string {
  const [version, iv, authTag, ciphertext] = payload.split('.');
  if (version !== 'v1' || !iv || !authTag || !ciphertext) {
    throw new Error('unrecognised field-crypto payload');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'), {
    authTagLength: 16,
  });
  decipher.setAuthTag(Buffer.from(authTag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

/** The current TOTP code for a seeded staff member, from their enrolment secret. */
export async function staffTotpCode(email: string): Promise<string> {
  const encrypted = await withMongo(async (client) => {
    const credential = await client
      .db()
      .collection('user_credentials')
      .findOne({ email }, { projection: { mfaSecretEncrypted: 1 } });
    return (credential?.mfaSecretEncrypted as string | null) ?? null;
  });
  if (!encrypted) {
    throw new Error(`no MFA secret on file for ${email} — is the seed current?`);
  }
  const secret = decryptField(encrypted, fieldEncryptionKey());
  return totp(secret);
}

/** `env` re-exported so the login flow can build the verify URL without a second import. */
export { env };
