import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { frozenClock, leanQuery, TEST_NOW } from '../__tests__/helpers.js';
import { TRUSTED_DEVICE_TTL_MS } from '../auth.constants.js';
import type { TrustedDeviceDoc } from '../infrastructure/auth.schemas.js';
import { TrustedDeviceService } from './trusted-device.service.js';

function setup() {
  const devices = {
    updateOne: vi.fn().mockResolvedValue({}),
    updateMany: vi.fn().mockResolvedValue({ modifiedCount: 3 }),
    findOne: vi.fn(),
  };
  const service = new TrustedDeviceService(
    devices as unknown as Model<TrustedDeviceDoc>,
    frozenClock(),
  );
  return { devices, service };
}

describe('trust', () => {
  it('upserts the user/device pair with a 30-day expiry', async () => {
    const { devices, service } = setup();

    await service.trust({ userId: 'usr-1', deviceId: 'dev-1', label: 'Chrome on macOS' });

    expect(devices.updateOne).toHaveBeenCalledWith(
      { userId: 'usr-1', deviceId: 'dev-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          expiresAt: new Date(TEST_NOW.getTime() + TRUSTED_DEVICE_TTL_MS),
          revokedAt: null,
        }),
      }),
      { upsert: true },
    );
  });
});

describe('isTrusted', () => {
  it('is false when no live row matches', async () => {
    const { devices, service } = setup();
    devices.findOne.mockReturnValue(leanQuery(null));

    await expect(service.isTrusted('usr-1', 'dev-1')).resolves.toBe(false);
    expect(devices.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'usr-1', deviceId: 'dev-1', revokedAt: null }),
    );
  });

  it('is true for a live row and touches lastSeenAt', async () => {
    const { devices, service } = setup();
    devices.findOne.mockReturnValue(leanQuery({ _id: 'td-1' }));

    await expect(service.isTrusted('usr-1', 'dev-1')).resolves.toBe(true);
    expect(devices.updateOne).toHaveBeenCalledWith(
      { _id: 'td-1' },
      { $set: { lastSeenAt: TEST_NOW } },
    );
  });
});

describe('revokeAllForUser', () => {
  it('revokes every live device and reports how many', async () => {
    const { devices, service } = setup();

    await expect(service.revokeAllForUser('usr-1')).resolves.toBe(3);
    expect(devices.updateMany).toHaveBeenCalledWith(
      { userId: 'usr-1', revokedAt: null },
      { $set: { revokedAt: TEST_NOW } },
    );
  });
});
