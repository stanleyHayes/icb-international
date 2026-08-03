import { Inject, Injectable } from '@nestjs/common';
import { authenticator } from 'otplib';
import { toDataURL } from 'qrcode';

import { FieldEncryptionService } from '../../../common/crypto/field-encryption.service.js';
import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import { TOTP_WINDOW_STEPS } from '../auth.constants.js';

const QR_CODE_WIDTH_PX = 256;

/**
 * TOTP secrets and codes, plus the QR code an authenticator app scans at enrolment.
 *
 * The secret is encrypted at rest (field-level, key from validated config — N9): the database
 * only ever holds ciphertext, so a leaked dump does not hand an attacker everyone's second
 * factor alongside their password hashes.
 */
@Injectable()
export class TotpService {
  constructor(
    @Inject(CONFIG) private readonly config: AppConfiguration,
    private readonly fieldCrypto: FieldEncryptionService,
  ) {
    // One step of drift either way: phone clocks are not NTP-perfect.
    authenticator.options = { window: TOTP_WINDOW_STEPS };
  }

  generateSecret(): string {
    return authenticator.generateSecret();
  }

  encryptSecret(secret: string): string {
    return this.fieldCrypto.encrypt(secret);
  }

  decryptSecret(encrypted: string): string {
    return this.fieldCrypto.decrypt(encrypted);
  }

  keyUri(email: string, secret: string): string {
    return authenticator.keyuri(email, this.config.bank.name, secret);
  }

  async qrCodeDataUri(otpauthUri: string): Promise<string> {
    return toDataURL(otpauthUri, { margin: 1, width: QR_CODE_WIDTH_PX });
  }

  /** False rather than a throw on malformed input — a bad code is a failed check, not a 500. */
  check(secret: string, code: string): boolean {
    try {
      return authenticator.check(code.trim(), secret);
    } catch {
      return false;
    }
  }
}
