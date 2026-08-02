import { Inject, Injectable } from '@nestjs/common';

import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { decryptField, encryptField } from './field-crypto.js';

/**
 * Field-level encryption keyed from validated config (N9).
 *
 * The key never appears in code or logs — it arrives as `FIELD_ENCRYPTION_KEY` (64 hex chars,
 * enforced by the boot-time config schema) and lives here as a Buffer for the process lifetime.
 * Domain modules encrypt before persisting and decrypt after reading; the database only ever
 * holds ciphertext.
 */
@Injectable()
export class FieldEncryptionService {
  private readonly key: Buffer;

  constructor(@Inject(CONFIG) config: AppConfiguration) {
    this.key = Buffer.from(config.crypto.fieldEncryptionKey, 'hex');
  }

  encrypt(plaintext: string): string {
    return encryptField(plaintext, this.key);
  }

  decrypt(payload: string): string {
    return decryptField(payload, this.key);
  }
}
