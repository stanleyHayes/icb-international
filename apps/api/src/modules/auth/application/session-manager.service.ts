import type { Session } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { SessionDoc } from '../../customers/infrastructure/customer.schemas.js';
import { AUDIT_ACTIONS, REVOKE_REASONS } from '../auth.constants.js';
import { toSession, type SessionRow } from '../infrastructure/session.mapper.js';
import { AUDIT_OUTCOMES, AuditPort } from './audit.port.js';
import { TrustedDeviceService } from './trusted-device.service.js';

/**
 * The customer's view of their own sessions, and the kill switch.
 *
 * Listing shows only live sessions — a revoked one is history, not something to act on.
 * `revokeAll` is the security reset used by password changes and resets: it also drops every
 * trusted device, because trust granted under the old credentials must not survive them.
 */
@Injectable()
export class SessionManagerService {
  constructor(
    @InjectModel(SessionDoc.name) private readonly sessions: Model<SessionDoc>,
    private readonly trustedDevices: TrustedDeviceService,
    private readonly clock: ClockService,
    private readonly audit: AuditPort,
  ) {}

  async list(userId: string, currentSessionId: string): Promise<Session[]> {
    const rows = await this.sessions
      .find({ userId, revokedAt: null, expiresAt: { $gt: this.clock.now() } })
      .sort({ lastSeenAt: -1 })
      .lean<SessionRow[]>();
    return rows.map((row) => toSession(row, currentSessionId));
  }

  /** Idempotent: revoking an already-revoked session is success, not an error. */
  async revoke(userId: string, sessionId: string): Promise<void> {
    const row = await this.sessions.findOne({ _id: sessionId, userId }).lean();
    if (row === null) {
      throw new NotFoundError('Session', sessionId);
    }
    if (row.revokedAt !== null) {
      return;
    }
    await this.sessions.updateOne(
      { _id: sessionId },
      { $set: { revokedAt: this.clock.now(), revokedReason: REVOKE_REASONS.ByUser } },
    );
    await this.audit.record({
      actorId: userId,
      action: AUDIT_ACTIONS.SessionRevoked,
      outcome: AUDIT_OUTCOMES.Success,
      context: { sessionId },
    });
  }

  /** Revokes every live session (optionally sparing one) and every trusted device. */
  async revokeAll(userId: string, reason: string, exceptSessionId?: string): Promise<number> {
    const filter: Record<string, unknown> = { userId, revokedAt: null };
    if (exceptSessionId !== undefined) {
      filter['_id'] = { $ne: exceptSessionId };
    }
    const result = await this.sessions.updateMany(filter, {
      $set: { revokedAt: this.clock.now(), revokedReason: reason },
    });
    await this.trustedDevices.revokeAllForUser(userId);
    return result.modifiedCount;
  }
}
