/* eslint-disable sonarjs/no-hardcoded-ip -- test fixture addresses, not live endpoints */

import { describe, expect, it, vi } from 'vitest';

import { asAudit, mockAudit } from '../__tests__/helpers.js';
import type { DeviceContext, IssuedSession } from './auth.types.js';
import type { CredentialVerifier } from './credential-verifier.service.js';
import { LoginService } from './login.service.js';
import type { MfaChallengeService } from './mfa-challenge.service.js';
import type { SessionIssuer } from './session-issuer.service.js';
import type { TrustedDeviceService } from './trusted-device.service.js';
import type { UserProfileReader } from './user-profile-reader.js';

const DEVICE: DeviceContext = { deviceId: null, userAgent: 'Chrome', ipAddress: '10.0.0.1' };
const CHALLENGE = { challengeId: 'chl-1', method: 'totp' as const, expiresAt: '2026-08-02T12:10:00.000Z' };

function issued(): IssuedSession {
  return {
    accessToken: 'jwt',
    expiresIn: 900,
    refreshToken: 'refresh',
    refreshTtlMs: 86_400_000,
    user: {
      userId: 'usr-1',
      customerId: 'cus-1',
      email: 'ama@example.com',
      firstName: 'Ama',
      lastName: 'Mensah',
      emailVerified: true,
      mfaEnabled: true,
      roles: [],
      lastLoginAt: null,
    },
  };
}

function setup() {
  const verifier = { verify: vi.fn() };
  const challenges = { issue: vi.fn().mockResolvedValue(CHALLENGE), verify: vi.fn() };
  const trustedDevices = { isTrusted: vi.fn(), trust: vi.fn().mockResolvedValue(undefined) };
  const sessionIssuer = { issue: vi.fn().mockResolvedValue(issued()) };
  const profiles = { phoneForCustomer: vi.fn().mockResolvedValue('+233244124521') };
  const audit = mockAudit();
  const service = new LoginService(
    verifier as unknown as CredentialVerifier,
    challenges as unknown as MfaChallengeService,
    trustedDevices as unknown as TrustedDeviceService,
    sessionIssuer as unknown as SessionIssuer,
    profiles as unknown as UserProfileReader,
    asAudit(audit),
  );
  return { verifier, challenges, trustedDevices, sessionIssuer, audit, service };
}

const credential = (mfaEnabled: boolean) => ({
  _id: 'usr-1',
  email: 'ama@example.com',
  customerId: 'cus-1',
  mfaEnabled,
  mfaSecretEncrypted: mfaEnabled ? 'enc:x' : null,
  recoveryCodeHashes: [] as string[],
});

describe('login', () => {
  it('issues a session straight away when MFA is not enabled', async () => {
    const { verifier, sessionIssuer, audit, service } = setup();
    verifier.verify.mockResolvedValue(credential(false));

    const outcome = await service.login({ email: 'ama@example.com', password: 'x' }, DEVICE);

    expect(outcome.outcome).toBe('authenticated');
    expect(sessionIssuer.issue).toHaveBeenCalledWith('usr-1', DEVICE, { trusted: false });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login', outcome: 'success' }),
    );
  });

  it('hands back a challenge when MFA is enabled and the device is unknown', async () => {
    const { verifier, challenges, trustedDevices, sessionIssuer, audit, service } = setup();
    verifier.verify.mockResolvedValue(credential(true));
    trustedDevices.isTrusted.mockResolvedValue(false);

    const outcome = await service.login(
      { email: 'ama@example.com', password: 'x', deviceId: 'dev-9' },
      DEVICE,
    );

    expect(outcome).toEqual({ outcome: 'mfa_required', challenge: CHALLENGE });
    expect(challenges.issue).toHaveBeenCalledWith(
      credential(true),
      { ...DEVICE, deviceId: 'dev-9' },
      { phone: '+233244124521' },
    );
    expect(sessionIssuer.issue).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.mfa_challenge_issued' }),
    );
  });

  it('skips MFA on a trusted device', async () => {
    const { verifier, challenges, trustedDevices, sessionIssuer, service } = setup();
    verifier.verify.mockResolvedValue(credential(true));
    trustedDevices.isTrusted.mockResolvedValue(true);

    const outcome = await service.login(
      { email: 'ama@example.com', password: 'x', deviceId: 'dev-1' },
      DEVICE,
    );

    expect(outcome.outcome).toBe('authenticated');
    expect(challenges.issue).not.toHaveBeenCalled();
    expect(sessionIssuer.issue).toHaveBeenCalledWith(
      'usr-1',
      { ...DEVICE, deviceId: 'dev-1' },
      { trusted: true },
    );
  });

  it('demands MFA whenever no device id was presented', async () => {
    const { verifier, trustedDevices, service } = setup();
    verifier.verify.mockResolvedValue(credential(true));

    const outcome = await service.login({ email: 'ama@example.com', password: 'x' }, DEVICE);

    expect(outcome.outcome).toBe('mfa_required');
    expect(trustedDevices.isTrusted).not.toHaveBeenCalled();
  });
});

describe('verifyMfa', () => {
  const verified = {
    userId: 'usr-1',
    purpose: null,
    deviceId: 'dev-1',
    userAgent: 'Chrome',
    ipAddress: '10.0.0.1',
    usedRecoveryCode: false,
  };

  it('issues a trusted session from the challenge context', async () => {
    const { challenges, sessionIssuer, audit, service } = setup();
    challenges.verify.mockResolvedValue(verified);

    const session = await service.verifyMfa({ challengeId: 'chl-1', code: '123456', trustDevice: false });

    expect(session.accessToken).toBe('jwt');
    expect(sessionIssuer.issue).toHaveBeenCalledWith(
      'usr-1',
      { deviceId: 'dev-1', userAgent: 'Chrome', ipAddress: '10.0.0.1' },
      { trusted: true },
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: 'auth.login' }));
  });

  it('registers the device when the customer asks to trust it', async () => {
    const { challenges, trustedDevices, audit, service } = setup();
    challenges.verify.mockResolvedValue(verified);

    await service.verifyMfa({ challengeId: 'chl-1', code: '123456', trustDevice: true });

    expect(trustedDevices.trust).toHaveBeenCalledWith({
      userId: 'usr-1',
      deviceId: 'dev-1',
      label: 'Browser on Unknown device',
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.device_trusted' }),
    );
  });

  it('does not trust anything when there is no device id to trust', async () => {
    const { challenges, trustedDevices, service } = setup();
    challenges.verify.mockResolvedValue({ ...verified, deviceId: null });

    await service.verifyMfa({ challengeId: 'chl-1', code: '123456', trustDevice: true });

    expect(trustedDevices.trust).not.toHaveBeenCalled();
  });

  it('audits recovery-code logins distinctly', async () => {
    const { challenges, audit, service } = setup();
    challenges.verify.mockResolvedValue({ ...verified, usedRecoveryCode: true });

    await service.verifyMfa({ challengeId: 'chl-1', code: 'ABCDE-12345', trustDevice: false });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.recovery_code_used' }),
    );
  });
});
