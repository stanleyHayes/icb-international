import { authenticator } from 'otplib';
import { describe, expect, it } from 'vitest';

import { FieldEncryptionService } from '../../../common/crypto/field-encryption.service.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import { TotpService } from './totp.service.js';

function setup() {
  const config = {
    bank: { name: 'International Commercial Bank' },
    crypto: { fieldEncryptionKey: 'ab'.repeat(32) },
  } as AppConfiguration;
  return new TotpService(config, new FieldEncryptionService(config));
}

describe('TotpService', () => {
  it('round-trips a secret through encryption', () => {
    const service = setup();
    const secret = service.generateSecret();

    const encrypted = service.encryptSecret(secret);

    expect(encrypted).not.toContain(secret);
    expect(service.decryptSecret(encrypted)).toBe(secret);
  });

  it('builds an otpauth URI carrying the bank as issuer', () => {
    const service = setup();
    const uri = service.keyUri('ama@example.com', 'JBSWY3DPEHPK3PXP');

    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri).toContain('International%20Commercial%20Bank');
  });

  it('renders the QR code as a PNG data URI', async () => {
    const service = setup();
    const dataUri = await service.qrCodeDataUri('otpauth://totp/x?secret=JBSWY3DPEHPK3PXP');

    expect(dataUri.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('accepts the code the authenticator app would show, and rejects any other', () => {
    const service = setup();
    const secret = service.generateSecret();
    const code = authenticator.generate(secret);

    expect(service.check(secret, code)).toBe(true);
    expect(service.check(secret, '000000')).toBe(false);
  });

  it('returns false rather than throwing on a malformed secret', () => {
    expect(setup().check('not-a-secret!!', '123456')).toBe(false);
  });
});
