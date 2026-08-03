/* eslint-disable sonarjs/no-hardcoded-ip -- test fixture addresses, not live endpoints */

import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { type UserCredentialDoc } from '../../customers/infrastructure/customer.schemas.js';
import { asAudit, leanQuery, mockAudit, TEST_NOW } from '../__tests__/helpers.js';
import type { DeviceContext } from './auth.types.js';
import type { MfaChallengeService } from './mfa-challenge.service.js';
import { StepUpService } from './step-up.service.js';
import type { TokenService } from './token.service.js';
import type { UserProfileReader } from './user-profile-reader.js';

const DEVICE: DeviceContext = { deviceId: 'dev-1', userAgent: 'Chrome', ipAddress: '10.0.0.1' };
const CHALLENGE = {
  challengeId: 'chl-1',
  method: 'totp' as const,
  expiresAt: TEST_NOW.toISOString(),
};

function setup() {
  const credentials = { findById: vi.fn() };
  const challenges = {
    issue: vi.fn().mockResolvedValue(CHALLENGE),
    verify: vi.fn(),
  };
  const tokens = {
    issueStepUpToken: vi.fn().mockResolvedValue({ token: 'step.jwt', expiresAt: TEST_NOW }),
  };
  const profiles = { phoneForCustomer: vi.fn().mockResolvedValue('+233244124521') };
  const audit = mockAudit();
  const service = new StepUpService(
    credentials as unknown as Model<UserCredentialDoc>,
    challenges as unknown as MfaChallengeService,
    tokens as unknown as TokenService,
    profiles as unknown as UserProfileReader,
    asAudit(audit),
  );
  return { credentials, challenges, tokens, audit, service };
}

describe('request', () => {
  it('issues a purpose-pinned challenge and audits it', async () => {
    const { credentials, challenges, audit, service } = setup();
    credentials.findById.mockReturnValue(leanQuery({ _id: 'usr-1', active: true, customerId: 'c-1' }));

    const result = await service.request('usr-1', 'reveal_card', DEVICE);

    expect(result).toEqual(CHALLENGE);
    expect(challenges.issue).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'usr-1' }),
      DEVICE,
      { purpose: 'reveal_card', phone: '+233244124521' },
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.step_up_requested', context: { purpose: 'reveal_card' } }),
    );
  });

  it('rejects a stale principal', async () => {
    const { credentials, service } = setup();
    credentials.findById.mockReturnValue(leanQuery(null));

    await expect(service.request('usr-1', 'reveal_card', DEVICE)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});

describe('verify', () => {
  it('mints a single-purpose step-up token', async () => {
    const { challenges, tokens, audit, service } = setup();
    challenges.verify.mockResolvedValue({
      userId: 'usr-1',
      purpose: 'high_value_transfer',
      deviceId: 'dev-1',
      userAgent: 'Chrome',
      ipAddress: '10.0.0.1',
      usedRecoveryCode: false,
    });

    const result = await service.verify('usr-1', { challengeId: 'chl-1', code: '123456' });

    expect(tokens.issueStepUpToken).toHaveBeenCalledWith({
      sub: 'usr-1',
      purpose: 'high_value_transfer',
    });
    expect(result).toEqual({ stepUpToken: 'step.jwt', expiresAt: TEST_NOW.toISOString() });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.step_up_verified' }),
    );
  });

  it('refuses a challenge that is not a step-up, or belongs to someone else', async () => {
    const { challenges, service } = setup();
    challenges.verify.mockResolvedValue({
      userId: 'usr-1',
      purpose: null,
      deviceId: null,
      userAgent: 'Chrome',
      ipAddress: '10.0.0.1',
      usedRecoveryCode: false,
    });

    await expect(
      service.verify('usr-1', { challengeId: 'chl-1', code: '123456' }),
    ).rejects.toMatchObject({ code: 'MFA_INVALID' });

    challenges.verify.mockResolvedValue({
      userId: 'usr-2',
      purpose: 'reveal_card',
      deviceId: null,
      userAgent: 'Chrome',
      ipAddress: '10.0.0.1',
      usedRecoveryCode: false,
    });
    await expect(
      service.verify('usr-1', { challengeId: 'chl-1', code: '123456' }),
    ).rejects.toMatchObject({ code: 'MFA_INVALID' });
  });
});
