/* eslint-disable sonarjs/no-hardcoded-ip -- test fixture addresses, not live endpoints */

import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { type SessionDoc } from '../../customers/infrastructure/customer.schemas.js';
import { asAudit, frozenClock, leanQuery, mockAudit, TEST_NOW } from '../__tests__/helpers.js';
import { REVOKE_REASONS } from '../auth.constants.js';
import { SessionManagerService } from './session-manager.service.js';
import type { TrustedDeviceService } from './trusted-device.service.js';

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36';

function sessionRow(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'ses-1',
    userId: 'usr-1',
    familyId: 'fam-1',
    tokenHash: 'hash',
    device: { label: 'Chrome on macOS', userAgent: CHROME_MAC, deviceId: 'dev-1' },
    ipAddress: '10.0.0.1',
    location: null,
    trusted: true,
    lastSeenAt: TEST_NOW,
    createdAt: TEST_NOW,
    expiresAt: new Date(TEST_NOW.getTime() + 86_400_000),
    revokedAt: null,
    revokedReason: null,
    ...overrides,
  };
}

function setup() {
  const sessions = { find: vi.fn(), findOne: vi.fn(), updateOne: vi.fn(), updateMany: vi.fn() };
  const trustedDevices = { revokeAllForUser: vi.fn().mockResolvedValue(1) };
  const audit = mockAudit();
  const service = new SessionManagerService(
    sessions as unknown as Model<SessionDoc>,
    trustedDevices as unknown as TrustedDeviceService,
    frozenClock(),
    asAudit(audit),
  );
  return { sessions, trustedDevices, audit, service };
}

describe('list', () => {
  it('maps live sessions to the contract shape and flags the current one', async () => {
    const { sessions, service } = setup();
    const rows = [sessionRow(), sessionRow({ _id: 'ses-2', trusted: false })];
    sessions.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(rows) }),
    });

    const result = await service.list('usr-1', 'ses-2');

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: 'ses-1',
      device: { label: 'Chrome on macOS', browser: 'Chrome', os: 'macOS', trusted: true },
      ipAddress: '10.0.0.1',
      current: false,
    });
    expect(result[1]?.current).toBe(true);
    expect(sessions.find).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'usr-1', revokedAt: null }),
    );
  });
});

describe('revoke', () => {
  it('revokes the caller-owned session and audits', async () => {
    const { sessions, audit, service } = setup();
    sessions.findOne.mockReturnValue(leanQuery(sessionRow()));

    await service.revoke('usr-1', 'ses-1');

    expect(sessions.updateOne).toHaveBeenCalledWith(
      { _id: 'ses-1' },
      { $set: { revokedAt: TEST_NOW, revokedReason: REVOKE_REASONS.ByUser } },
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.session_revoked', context: { sessionId: 'ses-1' } }),
    );
  });

  it('is a no-op for an already-revoked session', async () => {
    const { sessions, service } = setup();
    sessions.findOne.mockReturnValue(leanQuery(sessionRow({ revokedAt: TEST_NOW })));

    await service.revoke('usr-1', 'ses-1');

    expect(sessions.updateOne).not.toHaveBeenCalled();
  });

  it('refuses sessions the caller does not own (or that do not exist)', async () => {
    const { sessions, service } = setup();
    sessions.findOne.mockReturnValue(leanQuery(null));

    await expect(service.revoke('usr-1', 'ses-9')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('revokeAll', () => {
  it('spares the current session when asked and drops trusted devices', async () => {
    const { sessions, trustedDevices, service } = setup();
    sessions.updateMany.mockResolvedValue({ modifiedCount: 4 });

    const count = await service.revokeAll('usr-1', REVOKE_REASONS.PasswordChange, 'ses-1');

    expect(count).toBe(4);
    expect(sessions.updateMany).toHaveBeenCalledWith(
      { userId: 'usr-1', revokedAt: null, _id: { $ne: 'ses-1' } },
      { $set: { revokedAt: TEST_NOW, revokedReason: REVOKE_REASONS.PasswordChange } },
    );
    expect(trustedDevices.revokeAllForUser).toHaveBeenCalledWith('usr-1');
  });

  it('revokes everything when no session is spared', async () => {
    const { sessions, service } = setup();
    sessions.updateMany.mockResolvedValue({ modifiedCount: 4 });

    await service.revokeAll('usr-1', REVOKE_REASONS.PasswordReset);

    expect(sessions.updateMany).toHaveBeenCalledWith(
      { userId: 'usr-1', revokedAt: null },
      expect.anything(),
    );
  });
});
