import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { SessionDoc } from '../../customers/infrastructure/customer.schemas.js';
import type { DeviceContext } from './auth.types.js';
import { describeDevice } from '../domain/device-label.js';

export interface RecordSessionInput {
  sessionId: string;
  userId: string;
  refresh: { hash: string; ttlMs: number };
  device: DeviceContext;
  /** Present when rotating: the new session joins the existing token family. */
  familyId: string | undefined;
  /** True when the login satisfied MFA or came from a trusted device. */
  trusted: boolean;
}

/**
 * Writes the session row that a refresh token points at.
 *
 * Split out of AuthService because it is the one piece of session handling that is pure
 * persistence — keeping it here leaves AuthService about policy (lockouts, reuse detection,
 * rotation) rather than about document shapes.
 */
@Injectable()
export class SessionWriter {
  constructor(
    @InjectModel(SessionDoc.name) private readonly sessions: Model<SessionDoc>,
    private readonly clock: ClockService,
  ) {}

  async record(input: RecordSessionInput): Promise<void> {
    const now = this.clock.now();

    await this.sessions.create([
      {
        _id: input.sessionId,
        userId: input.userId,
        familyId: input.familyId ?? newId(),
        tokenHash: input.refresh.hash,
        device: {
          label: describeDevice(input.device.userAgent),
          userAgent: input.device.userAgent,
          deviceId: input.device.deviceId,
        },
        ipAddress: input.device.ipAddress,
        location: null,
        trusted: input.trusted,
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + input.refresh.ttlMs),
        revokedAt: null,
        revokedReason: null,
      },
    ]);
  }
}
