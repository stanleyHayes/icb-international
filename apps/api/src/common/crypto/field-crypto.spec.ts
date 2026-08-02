import { describe, expect, it } from 'vitest';

import type { AppConfiguration } from '../../config/configuration.js';
import { decryptField, encryptField } from './field-crypto.js';
import { KEY_BYTES } from './field-crypto.constants.js';
import { FieldEncryptionService } from './field-encryption.service.js';

const KEY = Buffer.alloc(KEY_BYTES, 7);
const OTHER_KEY = Buffer.alloc(KEY_BYTES, 9);

describe('field-crypto', () => {
  it('round-trips a PAN', () => {
    const payload = encryptField('4111111111111111', KEY);
    expect(decryptField(payload, KEY)).toBe('4111111111111111');
  });

  it('never emits the plaintext in the payload', () => {
    const payload = encryptField('4111111111111111', KEY);
    expect(payload).not.toContain('4111');
    expect(payload.startsWith('v1.')).toBe(true);
  });

  it('produces a different ciphertext per call (random IV)', () => {
    expect(encryptField('same', KEY)).not.toBe(encryptField('same', KEY));
  });

  it('round-trips unicode PII', () => {
    const payload = encryptField('Zoë Mënsah — GH-8834', KEY);
    expect(decryptField(payload, KEY)).toBe('Zoë Mënsah — GH-8834');
  });

  it('rejects a tampered ciphertext', () => {
    const payload = encryptField('secret', KEY);
    const tampered = `${payload.slice(0, -2)}xx`;
    expect(() => decryptField(tampered, KEY)).toThrow(
      expect.objectContaining({ code: 'INTERNAL_ERROR' }) as Error,
    );
  });

  it('rejects the wrong key', () => {
    const payload = encryptField('secret', KEY);
    expect(() => decryptField(payload, OTHER_KEY)).toThrow(
      expect.objectContaining({ code: 'INTERNAL_ERROR' }) as Error,
    );
  });

  it('rejects malformed payloads', () => {
    for (const bad of ['', 'v1', 'v1.a.b', 'v2.a.b.c', 'v1..b.c']) {
      expect(() => decryptField(bad, KEY)).toThrow(
        expect.objectContaining({ code: 'INTERNAL_ERROR' }) as Error,
      );
    }
  });
});

describe('FieldEncryptionService', () => {
  const config = {
    crypto: { fieldEncryptionKey: KEY.toString('hex') },
  } as AppConfiguration;

  it('round-trips through the configured key', () => {
    const service = new FieldEncryptionService(config);
    const payload = service.encrypt('GHA-123456789');

    expect(service.decrypt(payload)).toBe('GHA-123456789');
    expect(decryptField(payload, KEY)).toBe('GHA-123456789');
  });
});
