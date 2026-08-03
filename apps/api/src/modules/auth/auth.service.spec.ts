/* eslint-disable sonarjs/no-hardcoded-ip -- test fixture addresses, not live endpoints */

import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { type SessionDoc } from '../customers/infrastructure/customer.schemas.js';
import { asAudit, frozenClock, leanQuery, mockAudit, TEST_NOW } from './__tests__/helpers.js';
import { REVOKE_REASONS } from './auth.constants.js';
import { AuthService } from './auth.service.js';
import type { DeviceContext } from './application/auth.types.js';
import type { SessionIssuer } from './application/session-issuer.service.js';
import type { TokenService } from './application/token.service.js';

const DEVICE: DeviceContext = { deviceId: null, userAgent: 'Chrome', ipAddress: '10.0.0.1' };

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'ses-1',
    userId: 'usr-1',
    familyId: 'fam-1',
    tokenHash: 'hash-of-token',
    expiresAt: new Date(TEST_NOW.getTime() + 86_400_000),
    revokedAt: null,
    ...overrides,
  };
}

function setup() {
  const sessions = {
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 2 }),
  };
  const tokens = { hashRefreshToken: vi.fn().mockReturnValue('hash-of-token') };
  const sessionIssuer = { issue: vi.fn().mockResolvedValue({ accessToken: 'jwt' }) };
  const audit = mockAudit();
  const service = new AuthService(
    sessions as unknown as Model<SessionDoc>,
    tokens as unknown as TokenService,
    sessionIssuer as unknown as SessionIssuer,
    frozenClock(),
    asAudit(audit),
  );
  return { sessions, tokens, sessionIssuer, audit, service };
}

describe('refresh', () => {
  it('rejects an unknown token as an expired session', async () => {
    const { sessions, service } = setup();
    sessions.findOne.mockReturnValue(leanQuery(null));

    await expect(service.refresh('nope', DEVICE)).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
    });
  });

  it('rejects a session past its expiry', async () => {
    const { sessions, service } = setup();
    sessions.findOne.mockReturnValue(
      leanQuery(sessionRow({ expiresAt: new Date(TEST_NOW.getTime() - 1) })),
    );

    await expect(service.refresh('token', DEVICE)).rejects.toMatchObject({
      code: 'SESSION_EXPIRED',
    });
  });

  it('revokes the whole family when a rotated token is replayed', async () => {
    const { sessions, sessionIssuer, audit, service } = setup();
    sessions.findOne.mockReturnValue(leanQuery(sessionRow({ revokedAt: TEST_NOW })));

    await expect(service.refresh('stolen-copy', DEVICE)).rejects.toMatchObject({
      code: 'REFRESH_TOKEN_REUSED',
    });

    expect(sessions.updateMany).toHaveBeenCalledWith(
      { familyId: 'fam-1', revokedAt: null },
      { $set: { revokedAt: TEST_NOW, revokedReason: REVOKE_REASONS.RefreshReuse } },
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.refresh_reuse_detected', outcome: 'failure' }),
    );
    expect(sessionIssuer.issue).not.toHaveBeenCalled();
  });

  it('rotates the token into the same family and audits the rotation', async () => {
    const { sessions, sessionIssuer, audit, service } = setup();
    sessions.findOne.mockReturnValue(leanQuery(sessionRow()));

    const issued = await service.refresh('token', DEVICE);

    expect(issued.accessToken).toBe('jwt');
    expect(sessions.updateOne).toHaveBeenCalledWith(
      { _id: 'ses-1' },
      { $set: { revokedAt: TEST_NOW, revokedReason: REVOKE_REASONS.Rotated } },
    );
    expect(sessionIssuer.issue).toHaveBeenCalledWith('usr-1', DEVICE, { familyId: 'fam-1' });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.refresh_rotated', outcome: 'success' }),
    );
  });
});

describe('logout', () => {
  it('revokes the matching session and audits with its owner', async () => {
    const { sessions, audit, service } = setup();
    sessions.findOneAndUpdate.mockReturnValue(leanQuery(sessionRow()));

    await service.logout('token');

    expect(sessions.findOneAndUpdate).toHaveBeenCalledWith(
      { tokenHash: 'hash-of-token', revokedAt: null },
      { $set: { revokedAt: TEST_NOW, revokedReason: REVOKE_REASONS.Logout } },
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.logout', actorId: 'usr-1' }),
    );
  });

  it('is silent when the token matches nothing', async () => {
    const { sessions, audit, service } = setup();
    sessions.findOneAndUpdate.mockReturnValue(leanQuery(null));

    await service.logout('stale');

    expect(audit.record).not.toHaveBeenCalled();
  });
});

describe('logoutEverywhere', () => {
  it('revokes every live session and reports the count', async () => {
    const { sessions, audit, service } = setup();

    await expect(service.logoutEverywhere('usr-1')).resolves.toBe(2);
    expect(sessions.updateMany).toHaveBeenCalledWith(
      { userId: 'usr-1', revokedAt: null },
      { $set: { revokedAt: TEST_NOW, revokedReason: REVOKE_REASONS.LogoutAll } },
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.logout_all', context: { sessionsRevoked: 2 } }),
    );
  });
});
