/* eslint-disable sonarjs/no-hardcoded-ip -- test fixture addresses, not live endpoints */

import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { type UserCredentialDoc } from '../../customers/infrastructure/customer.schemas.js';
import { frozenClock, leanQuery, TEST_NOW } from '../__tests__/helpers.js';
import { MFA_CHALLENGE_TTL_MS, MFA_MAX_ATTEMPTS } from '../auth.constants.js';
import type { MfaChallengeDoc } from '../infrastructure/auth.schemas.js';
import type { DeviceContext } from './auth.types.js';
import { MfaChallengeService } from './mfa-challenge.service.js';
import { PasswordService } from './password.service.js';
import type { SmsOtpSender } from './sms-otp.sender.js';
import type { TotpService } from './totp.service.js';

const DEVICE: DeviceContext = { deviceId: 'dev-1', userAgent: 'Chrome', ipAddress: '10.0.0.1' };

function credential(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'usr-1',
    email: 'ama@example.com',
    customerId: 'cus-1',
    mfaSecretEncrypted: 'enc:secret',
    recoveryCodeHashes: [] as string[],
    active: true,
    ...overrides,
  };
}

function challenge(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'chl-1',
    userId: 'usr-1',
    method: 'totp',
    codeHash: null,
    purpose: null,
    deviceId: 'dev-1',
    userAgent: 'Chrome',
    ipAddress: '10.0.0.1',
    attempts: 0,
    expiresAt: new Date(TEST_NOW.getTime() + MFA_CHALLENGE_TTL_MS),
    consumedAt: null,
    ...overrides,
  };
}

function setup() {
  const challenges = { create: vi.fn().mockResolvedValue([{}]), findOne: vi.fn(), updateOne: vi.fn().mockResolvedValue({}) };
  const credentials = { findById: vi.fn(), updateOne: vi.fn().mockResolvedValue({}) };
  const totp = { check: vi.fn(), decryptSecret: vi.fn().mockReturnValue('secret') };
  const sms = { sendOtp: vi.fn() };
  const service = new MfaChallengeService(
    challenges as unknown as Model<MfaChallengeDoc>,
    credentials as unknown as Model<UserCredentialDoc>,
    totp as unknown as TotpService,
    new PasswordService(),
    sms as unknown as SmsOtpSender,
    frozenClock(),
  );
  return { challenges, credentials, totp, sms, service };
}

describe('issue', () => {
  it('issues a TOTP challenge when an authenticator is enrolled', async () => {
    const { challenges, service } = setup();

    const result = await service.issue(credential(), DEVICE);

    expect(result.method).toBe('totp');
    expect(result.expiresAt).toBe(new Date(TEST_NOW.getTime() + MFA_CHALLENGE_TTL_MS).toISOString());
    const [rows] = challenges.create.mock.calls[0] as [Record<string, unknown>[]];
    expect(rows[0]).toMatchObject({ userId: 'usr-1', method: 'totp', codeHash: null, deviceId: 'dev-1' });
  });

  it('pins the step-up purpose onto the challenge', async () => {
    const { challenges, service } = setup();

    await service.issue(credential(), DEVICE, { purpose: 'reveal_card' });

    const [rows] = challenges.create.mock.calls[0] as [{ purpose: string | null }[]];
    expect(rows[0]?.purpose).toBe('reveal_card');
  });

  it('falls back to a simulated SMS code, hashed, with a masked hint', async () => {
    const { challenges, sms, service } = setup();

    const result = await service.issue(
      credential({ mfaSecretEncrypted: null }),
      DEVICE,
      { phone: '+233244124521' },
    );

    expect(result.method).toBe('sms');
    expect(result.hint).toBe('+233 ** *** 4521');
    const [rows] = challenges.create.mock.calls[0] as [{ codeHash: string }[]];
    expect(rows[0]?.codeHash).toHaveLength(64);
    const [phone, code] = sms.sendOtp.mock.calls[0] as [string, string];
    expect(phone).toBe('+233244124521');
    expect(code).toMatch(/^\d{6}$/);
  });

  it('refuses an SMS challenge when there is no phone to send to', async () => {
    const { service } = setup();

    await expect(
      service.issue(credential({ mfaSecretEncrypted: null }), DEVICE, { phone: null }),
    ).rejects.toMatchObject({ code: 'MFA_REQUIRED' });
  });
});

describe('verify', () => {
  it('consumes a valid TOTP challenge and returns its context', async () => {
    const { challenges, credentials, totp, service } = setup();
    challenges.findOne.mockReturnValue(leanQuery(challenge({ purpose: 'close_account' })));
    credentials.findById.mockReturnValue(leanQuery(credential()));
    totp.check.mockReturnValue(true);

    const verified = await service.verify('chl-1', '123456');

    expect(verified).toMatchObject({
      userId: 'usr-1',
      purpose: 'close_account',
      deviceId: 'dev-1',
      usedRecoveryCode: false,
    });
    const [, update] = challenges.updateOne.mock.calls[0] as [unknown, { $set: { consumedAt: Date } }];
    expect(update.$set.consumedAt).toEqual(TEST_NOW);
  });

  it('rejects a wrong code, counting the attempt', async () => {
    const { challenges, credentials, totp, service } = setup();
    challenges.findOne.mockReturnValue(leanQuery(challenge()));
    credentials.findById.mockReturnValue(leanQuery(credential()));
    totp.check.mockReturnValue(false);

    await expect(service.verify('chl-1', '000000')).rejects.toMatchObject({ code: 'MFA_INVALID' });

    const [, update] = challenges.updateOne.mock.calls[0] as [unknown, { $set: Record<string, unknown> }];
    expect(update.$set['attempts']).toBe(1);
    expect(update.$set['consumedAt']).toBeUndefined();
  });

  it('exhausts the challenge at the attempt ceiling', async () => {
    const { challenges, credentials, totp, service } = setup();
    challenges.findOne.mockReturnValue(leanQuery(challenge({ attempts: MFA_MAX_ATTEMPTS - 1 })));
    credentials.findById.mockReturnValue(leanQuery(credential()));
    totp.check.mockReturnValue(false);

    await expect(service.verify('chl-1', '000000')).rejects.toMatchObject({ code: 'MFA_INVALID' });

    const [, update] = challenges.updateOne.mock.calls[0] as [unknown, { $set: Record<string, unknown> }];
    expect(update.$set['consumedAt']).toEqual(TEST_NOW);
  });

  it('rejects expired, consumed, and exhausted challenges alike', async () => {
    const { challenges, service } = setup();
    const expired = challenge({ expiresAt: new Date(TEST_NOW.getTime() - 1) });
    challenges.findOne.mockReturnValue(leanQuery(expired));

    await expect(service.verify('chl-1', '123456')).rejects.toMatchObject({ code: 'MFA_INVALID' });

    challenges.findOne.mockReturnValue(leanQuery(challenge({ consumedAt: TEST_NOW })));
    await expect(service.verify('chl-1', '123456')).rejects.toMatchObject({ code: 'MFA_INVALID' });

    challenges.findOne.mockReturnValue(leanQuery(null));
    await expect(service.verify('chl-1', '123456')).rejects.toMatchObject({ code: 'MFA_INVALID' });
  });

  it('accepts a recovery code on a TOTP challenge and burns it', async () => {
    const { challenges, credentials, totp, service } = setup();
    const passwords = new PasswordService();
    const codeHash = passwords.hashToken('ABCDE-12345');
    challenges.findOne.mockReturnValue(leanQuery(challenge()));
    credentials.findById.mockReturnValue(leanQuery(credential({ recoveryCodeHashes: [codeHash] })));
    totp.check.mockReturnValue(false);

    const verified = await service.verify('chl-1', 'abcde-12345');

    expect(verified.usedRecoveryCode).toBe(true);
    expect(credentials.updateOne).toHaveBeenCalledWith(
      { _id: 'usr-1' },
      { $pull: { recoveryCodeHashes: codeHash } },
    );
  });

  it('accepts the SMS code on an SMS challenge', async () => {
    const { challenges, credentials, service } = setup();
    const passwords = new PasswordService();
    challenges.findOne.mockReturnValue(
      leanQuery(challenge({ method: 'sms', codeHash: passwords.hashToken('483920') })),
    );
    credentials.findById.mockReturnValue(leanQuery(credential({ mfaSecretEncrypted: null })));

    const verified = await service.verify('chl-1', '483920');

    expect(verified.usedRecoveryCode).toBe(false);
  });
});
