/* eslint-disable sonarjs/no-hardcoded-ip -- test fixture addresses, not live endpoints */

import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { type UserCredentialDoc } from '../../customers/infrastructure/customer.schemas.js';
import { asAudit, frozenClock, leanQuery, mockAudit, TEST_NOW } from '../__tests__/helpers.js';
import { RESET_TOKEN_TTL_MS, REVOKE_REASONS } from '../auth.constants.js';
import type { AuthMailerService } from './auth-mailer.service.js';
import type { DeviceContext } from './auth.types.js';
import { PasswordResetService } from './password-reset.service.js';
import { PasswordService } from './password.service.js';
import type { SessionManagerService } from './session-manager.service.js';

const DEVICE: DeviceContext = { deviceId: null, userAgent: 'Chrome', ipAddress: '10.0.0.1' };

function setup() {
  const credentials = { findOne: vi.fn(), updateOne: vi.fn().mockResolvedValue({}) };
  const mailer = {
    sendPasswordReset: vi.fn().mockResolvedValue(undefined),
    sendPasswordChangedNotice: vi.fn().mockResolvedValue(undefined),
  };
  const sessions = { revokeAll: vi.fn().mockResolvedValue(2) };
  const audit = mockAudit();
  const service = new PasswordResetService(
    credentials as unknown as Model<UserCredentialDoc>,
    new PasswordService(),
    mailer as unknown as AuthMailerService,
    sessions as unknown as SessionManagerService,
    frozenClock(),
    asAudit(audit),
  );
  return { credentials, mailer, sessions, audit, service };
}

describe('requestReset', () => {
  it('does nothing observable for an unknown email — no enumeration', async () => {
    const { credentials, mailer, audit, service } = setup();
    credentials.findOne.mockReturnValue(leanQuery(null));

    await service.requestReset('ghost@example.com', DEVICE);

    expect(credentials.updateOne).not.toHaveBeenCalled();
    expect(mailer.sendPasswordReset).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('stores a hashed one-hour token, mails the plaintext, and audits', async () => {
    const { credentials, mailer, audit, service } = setup();
    credentials.findOne.mockReturnValue(
      leanQuery({ _id: 'usr-1', email: 'ama@example.com', active: true }),
    );

    await service.requestReset('AMA@example.com', DEVICE);

    const [, update] = credentials.updateOne.mock.calls[0] as [
      unknown,
      { $set: { passwordResetTokenHash: string; passwordResetExpiresAt: Date } },
    ];
    expect(update.$set.passwordResetTokenHash).toHaveLength(64);
    expect(update.$set.passwordResetExpiresAt).toEqual(
      new Date(TEST_NOW.getTime() + RESET_TOKEN_TTL_MS),
    );
    expect(mailer.sendPasswordReset).toHaveBeenCalledWith('ama@example.com', expect.any(String));
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.password_reset_requested', actorId: 'usr-1' }),
    );
  });
});

describe('resetPassword', () => {
  const live = {
    _id: 'usr-1',
    email: 'ama@example.com',
    passwordResetExpiresAt: new Date(TEST_NOW.getTime() + 1_000),
  };

  it('rejects unknown and expired tokens identically', async () => {
    const { credentials, service } = setup();
    credentials.findOne.mockReturnValue(leanQuery(null));
    await expect(service.resetPassword('t', 'ValidPass123', DEVICE)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });

    credentials.findOne.mockReturnValue(
      leanQuery({ ...live, passwordResetExpiresAt: new Date(TEST_NOW.getTime() - 1) }),
    );
    await expect(service.resetPassword('t', 'ValidPass123', DEVICE)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
  });

  it('applies the breached-password policy to the new password', async () => {
    const { credentials, service } = setup();
    credentials.findOne.mockReturnValue(leanQuery(live));

    await expect(service.resetPassword('t', 'password123', DEVICE)).rejects.toMatchObject({
      code: 'PASSWORD_POLICY_VIOLATION',
    });
    expect(credentials.updateOne).not.toHaveBeenCalled();
  });

  it('resets the credential and kills every session', async () => {
    const { credentials, mailer, sessions, audit, service } = setup();
    credentials.findOne.mockReturnValue(leanQuery(live));

    await service.resetPassword('token', 'BrandNewPass99', DEVICE);

    const [, update] = credentials.updateOne.mock.calls[0] as [
      unknown,
      { $set: Record<string, unknown> },
    ];
    expect(update.$set).toMatchObject({
      passwordResetTokenHash: null,
      passwordResetExpiresAt: null,
      failedAttempts: 0,
      lockedUntil: null,
    });
    expect(typeof update.$set['passwordHash']).toBe('string');
    expect(sessions.revokeAll).toHaveBeenCalledWith('usr-1', REVOKE_REASONS.PasswordReset);
    expect(mailer.sendPasswordChangedNotice).toHaveBeenCalledWith('ama@example.com');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.password_reset_completed' }),
    );
  });
});
