import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { TRUSTED_DEVICE_TTL_MS } from '../auth.constants.js';
import { TrustedDeviceDoc } from '../infrastructure/auth.schemas.js';

export interface TrustDeviceInput {
  readonly userId: string;
  readonly deviceId: string;
  readonly label: string;
}

/**
 * Trusted devices ("remember this browser for 30 days").
 *
 * Trust is a pair — userId + deviceId — so trusting a browser on one account says nothing about
 * any other. Trust expires and is revoked wholesale on a password reset or change, because the
 * moment credentials change, prior trust decisions were made under duress of whoever knew the
 * old password.
 */
@Injectable()
export class TrustedDeviceService {
  constructor(
    @InjectModel(TrustedDeviceDoc.name) private readonly devices: Model<TrustedDeviceDoc>,
    private readonly clock: ClockService,
  ) {}

  /** Idempotent: re-trusting the same device renews the window rather than duplicating rows. */
  async trust(input: TrustDeviceInput): Promise<void> {
    const now = this.clock.now();
    await this.devices.updateOne(
      { userId: input.userId, deviceId: input.deviceId },
      {
        $set: {
          label: input.label,
          lastSeenAt: now,
          expiresAt: new Date(now.getTime() + TRUSTED_DEVICE_TTL_MS),
          revokedAt: null,
        },
        $setOnInsert: { _id: newId(), trustedAt: now },
      },
      { upsert: true },
    );
  }

  async isTrusted(userId: string, deviceId: string): Promise<boolean> {
    const row = await this.devices
      .findOne({ userId, deviceId, revokedAt: null, expiresAt: { $gt: this.clock.now() } })
      .lean();
    if (row === null) {
      return false;
    }
    await this.devices.updateOne({ _id: row._id }, { $set: { lastSeenAt: this.clock.now() } });
    return true;
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.devices.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: this.clock.now() } },
    );
    return result.modifiedCount;
  }
}
