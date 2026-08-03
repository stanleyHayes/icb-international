import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { type UserCredentialDoc } from '../../customers/infrastructure/customer.schemas.js';
import { asAudit, frozenClock, leanQuery, mockAudit, TEST_NOW } from '../__tests__/helpers.js';
import { MfaEnrolmentService } from './mfa-enrolment.service.js';
import { PasswordService } from './password.service.js';
import type { TotpService } from './totp.service.js';

function credential(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'usr-1',
    email: 'ama@example.com',
    active: true,
    mfaEnabled: false,
    mfaSecretEncrypted: null as string | null,
    ...overrides,
  };
}

function setup() {
  const credentials = { findById: vi.fn(), updateOne: vi.fn().mockResolvedValue({}) };
  const totp = {
    generateSecret: vi.fn().mockReturnValue('SECRETBASE32'),
    encryptSecret: vi.fn().mockReturnValue('enc:SECRETBASE32'),
    decryptSecret: vi.fn().mockReturnValue('SECRETBASE32'),
    keyUri: vi.fn().mockReturnValue('otpauth://totp/x'),
    qrCodeDataUri: vi.fn().mockResolvedValue('data:image/png;base64,AAAA'),
    check: vi.fn(),
  };
  const audit = mockAudit();
  const service = new MfaEnrolmentService(
    credentials as unknown as Model<UserCredentialDoc>,
    totp as unknown as TotpService,
    new PasswordService(),
    frozenClock(),
    asAudit(audit),
  );
  return { credentials, totp, audit, service };
}

describe('enrol', () => {
  it('stores the encrypted secret and returns the enrolment payload', async () => {
    const { credentials, service } = setup();
    credentials.findById.mockReturnValue(leanQuery(credential()));

    const result = await service.enrol('usr-1');

    expect(result).toEqual({
      secret: 'SECRETBASE32',
      otpauthUri: 'otpauth://totp/x',
      qrCodeDataUri: 'data:image/png;base64,AAAA',
    });
    expect(credentials.updateOne).toHaveBeenCalledWith(
      { _id: 'usr-1' },
      { $set: { mfaSecretEncrypted: 'enc:SECRETBASE32' } },
    );
  });

  it('refuses to enrol twice', async () => {
    const { credentials, service } = setup();
    credentials.findById.mockReturnValue(leanQuery(credential({ mfaEnabled: true })));

    await expect(service.enrol('usr-1')).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});

describe('confirm', () => {
  it('enables MFA and returns ten recovery codes, storing only hashes', async () => {
    const { credentials, totp, audit, service } = setup();
    credentials.findById.mockReturnValue(leanQuery(credential({ mfaSecretEncrypted: 'enc:x' })));
    totp.check.mockReturnValue(true);

    const result = await service.confirm('usr-1', '123456');

    expect(result.codes).toHaveLength(10);
    expect(result.generatedAt).toBe(TEST_NOW.toISOString());
    const [, update] = credentials.updateOne.mock.calls[0] as [
      unknown,
      { $set: { mfaEnabled: boolean; recoveryCodeHashes: string[] } },
    ];
    expect(update.$set.mfaEnabled).toBe(true);
    expect(update.$set.recoveryCodeHashes).toHaveLength(10);
    for (const hash of update.$set.recoveryCodeHashes) {
      expect(result.codes).not.toContain(hash);
    }
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.totp_enrolled', outcome: 'success' }),
    );
  });

  it('demands a pending enrolment before confirming', async () => {
    const { credentials, service } = setup();
    credentials.findById.mockReturnValue(leanQuery(credential()));

    await expect(service.confirm('usr-1', '123456')).rejects.toMatchObject({
      code: 'MFA_INVALID',
    });
  });

  it('rejects a wrong code without enabling anything', async () => {
    const { credentials, totp, service } = setup();
    credentials.findById.mockReturnValue(leanQuery(credential({ mfaSecretEncrypted: 'enc:x' })));
    totp.check.mockReturnValue(false);

    await expect(service.confirm('usr-1', '000000')).rejects.toMatchObject({
      code: 'MFA_INVALID',
    });
    expect(credentials.updateOne).not.toHaveBeenCalled();
  });
});

describe('disable', () => {
  it('clears the secret and recovery codes behind a valid code', async () => {
    const { credentials, totp, audit, service } = setup();
    credentials.findById.mockReturnValue(
      leanQuery(credential({ mfaEnabled: true, mfaSecretEncrypted: 'enc:x' })),
    );
    totp.check.mockReturnValue(true);

    await service.disable('usr-1', '123456');

    expect(credentials.updateOne).toHaveBeenCalledWith(
      { _id: 'usr-1' },
      { $set: { mfaEnabled: false, mfaSecretEncrypted: null, recoveryCodeHashes: [] } },
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.totp_disabled' }),
    );
  });

  it('refuses when MFA is not enabled, or when the code is wrong', async () => {
    const { credentials, totp, service } = setup();
    credentials.findById.mockReturnValue(leanQuery(credential()));
    await expect(service.disable('usr-1', '123456')).rejects.toMatchObject({ code: 'MFA_INVALID' });

    credentials.findById.mockReturnValue(
      leanQuery(credential({ mfaEnabled: true, mfaSecretEncrypted: 'enc:x' })),
    );
    totp.check.mockReturnValue(false);
    await expect(service.disable('usr-1', '000000')).rejects.toMatchObject({ code: 'MFA_INVALID' });
  });
});
