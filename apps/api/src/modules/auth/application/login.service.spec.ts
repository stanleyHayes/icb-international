/* eslint-disable sonarjs/no-hardcoded-ip -- test fixture addresses, not live endpoints */

import { describe, expect, it, vi } from 'vitest';

import { asAudit, mockAudit } from '../__tests__/helpers.js';
import type { DeviceContext, IssuedSession } from './auth.types.js';
import type { CredentialVerifier } from './credential-verifier.service.js';
import { LoginService } from './login.service.js';
import type { SessionIssuer } from './session-issuer.service.js';

const DEVICE: DeviceContext = { deviceId: null, userAgent: 'Chrome', ipAddress: '10.0.0.1' };

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
      roles: [],
      lastLoginAt: null,
    },
  };
}

function setup() {
  const verifier = { verify: vi.fn() };
  const sessionIssuer = { issue: vi.fn().mockResolvedValue(issued()) };
  const audit = mockAudit();
  const service = new LoginService(
    verifier as unknown as CredentialVerifier,
    sessionIssuer as unknown as SessionIssuer,
    asAudit(audit),
  );
  return { verifier, sessionIssuer, audit, service };
}

const credential = {
  _id: 'usr-1',
  email: 'ama@example.com',
  customerId: 'cus-1',
};

describe('login', () => {
  it('issues a session and audits the sign-in', async () => {
    const { verifier, sessionIssuer, audit, service } = setup();
    verifier.verify.mockResolvedValue(credential);

    const session = await service.login({ email: 'ama@example.com', password: 'x' }, DEVICE);

    expect(session.accessToken).toBe('jwt');
    expect(sessionIssuer.issue).toHaveBeenCalledWith('usr-1', DEVICE);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login', outcome: 'success' }),
    );
  });

  it('carries a presented device id onto the session context', async () => {
    const { verifier, sessionIssuer, service } = setup();
    verifier.verify.mockResolvedValue(credential);

    await service.login({ email: 'ama@example.com', password: 'x', deviceId: 'dev-9' }, DEVICE);

    expect(sessionIssuer.issue).toHaveBeenCalledWith('usr-1', { ...DEVICE, deviceId: 'dev-9' });
  });
});
