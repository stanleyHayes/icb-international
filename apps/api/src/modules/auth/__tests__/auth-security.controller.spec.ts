import type { FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthSecurityController } from '../auth-security.controller.js';
import { type ChangePasswordService } from '../application/change-password.service.js';
import { type EmailVerificationService } from '../application/email-verification.service.js';
import { type LoginHistoryService } from '../application/login-history.service.js';
import { type PasswordResetService } from '../application/password-reset.service.js';
import { type SessionManagerService } from '../application/session-manager.service.js';
import type { AccessTokenClaims } from '../application/token.service.js';

const CLAIMS = {
  sub: 'user-1',
  customerId: 'cust-1',
  email: 'ada@example.com',
  roles: ['customer'],
  sessionId: 'session-1',
} as AccessTokenClaims;

// Fixture credentials for the seeded demo logins — never a real secret.
const SEED_CREDENTIAL = 'old-password-1';
const NEW_SEED_CREDENTIAL = 'new-password-1';

function requestDouble(headers: Record<string, unknown> = {}): FastifyRequest {
  return { headers, ip: '198.51.100.4' } as unknown as FastifyRequest;
}

describe('AuthSecurityController', () => {
  let sessions: { list: ReturnType<typeof vi.fn>; revoke: ReturnType<typeof vi.fn> };
  let passwordReset: { requestReset: ReturnType<typeof vi.fn>; resetPassword: ReturnType<typeof vi.fn> };
  let changePassword: { change: ReturnType<typeof vi.fn> };
  let emailVerification: { confirm: ReturnType<typeof vi.fn> };
  let loginHistory: { list: ReturnType<typeof vi.fn> };
  let controller: AuthSecurityController;

  beforeEach(() => {
    sessions = {
      list: vi.fn().mockResolvedValue([{ id: 'session-1' }]),
      revoke: vi.fn().mockResolvedValue(undefined),
    };
    passwordReset = {
      requestReset: vi.fn().mockResolvedValue(undefined),
      resetPassword: vi.fn().mockResolvedValue(undefined),
    };
    changePassword = { change: vi.fn().mockResolvedValue(undefined) };
    emailVerification = { confirm: vi.fn().mockResolvedValue(undefined) };
    loginHistory = { list: vi.fn().mockResolvedValue([{ at: '2026-08-01T00:00:00.000Z' }]) };

    controller = new AuthSecurityController(
      sessions as unknown as SessionManagerService,
      passwordReset as unknown as PasswordResetService,
      changePassword as unknown as ChangePasswordService,
      emailVerification as unknown as EmailVerificationService,
      loginHistory as unknown as LoginHistoryService,
    );
  });

  it('lists the caller sessions, marking the current one', async () => {
    const result = await controller.listSessions(CLAIMS);

    expect(sessions.list).toHaveBeenCalledWith('user-1', 'session-1');
    expect(result).toEqual([{ id: 'session-1' }]);
  });

  it('lists the caller login history', async () => {
    const result = await controller.listLoginHistory(CLAIMS);

    expect(loginHistory.list).toHaveBeenCalledWith('user-1');
    expect(result).toHaveLength(1);
  });

  it('revokes the named session for the caller only', async () => {
    await controller.revokeSession(CLAIMS, 'session-9');

    expect(sessions.revoke).toHaveBeenCalledWith('user-1', 'session-9');
  });

  it('requests a password reset with the device context', async () => {
    await controller.forgotPassword(
      { email: 'ada@example.com' },
      requestDouble({ 'user-agent': 'Vitest Browser/1.0' }),
    );

    expect(passwordReset.requestReset).toHaveBeenCalledWith('ada@example.com', {
      deviceId: null,
      userAgent: 'Vitest Browser/1.0',
      ipAddress: '198.51.100.4',
    });
  });

  it('falls back to an unknown user agent when the header is not a string', async () => {
    await controller.forgotPassword(
      { email: 'ada@example.com' },
      requestDouble({ 'user-agent': ['a', 'b'] }),
    );

    expect(passwordReset.requestReset).toHaveBeenCalledWith(
      'ada@example.com',
      expect.objectContaining({ userAgent: 'unknown' }),
    );
  });

  it('resets the password with token, password, and device context', async () => {
    await controller.resetPassword(
      { token: 'reset-token', password: NEW_SEED_CREDENTIAL },
      requestDouble(),
    );

    expect(passwordReset.resetPassword).toHaveBeenCalledWith(
      'reset-token',
      NEW_SEED_CREDENTIAL,
      { deviceId: null, userAgent: 'unknown', ipAddress: '198.51.100.4' },
    );
  });

  it('changes the caller password scoped to the current session', async () => {
    const body = { currentPassword: SEED_CREDENTIAL, newPassword: NEW_SEED_CREDENTIAL };

    await controller.changeOwnPassword(CLAIMS, body);

    expect(changePassword.change).toHaveBeenCalledWith('user-1', 'session-1', body);
  });

  it('confirms email verification by token', async () => {
    await controller.verifyEmail({ token: 'verify-token' });

    expect(emailVerification.confirm).toHaveBeenCalledWith('verify-token');
  });
});
