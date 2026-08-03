import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { DomainError } from '../../common/errors/domain.error.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { SessionDoc } from '../customers/infrastructure/customer.schemas.js';
import { AUDIT_ACTIONS, REVOKE_REASONS } from './auth.constants.js';
import { AUDIT_OUTCOMES, AuditPort } from './application/audit.port.js';
import type { DeviceContext, IssuedSession } from './application/auth.types.js';
import { SessionIssuer } from './application/session-issuer.service.js';
import { TokenService } from './application/token.service.js';

/**
 * Session lifecycle: refresh rotation, logout, and the current-principal read.
 *
 * The behaviour worth reading closely: refresh tokens rotate, and presenting an
 * already-rotated token revokes the *entire family*, because the only way that happens is
 * theft — the legitimate client always uses the newest token.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(SessionDoc.name) private readonly sessions: Model<SessionDoc>,
    private readonly tokens: TokenService,
    private readonly sessionIssuer: SessionIssuer,
    private readonly clock: ClockService,
    private readonly audit: AuditPort,
  ) {}

  /**
   * Rotate a refresh token.
   *
   * The presented token is revoked and replaced. If it was *already* revoked, someone is using a
   * copy — every session in that family is killed and the customer is forced to log in again.
   */
  async refresh(refreshToken: string, device: DeviceContext): Promise<IssuedSession> {
    const session = await this.sessions
      .findOne({ tokenHash: this.tokens.hashRefreshToken(refreshToken) })
      .lean();

    if (!session || session.expiresAt.getTime() <= this.clock.epochMs()) {
      throw new DomainError('SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
    }

    if (session.revokedAt) {
      await this.revokeFamily(session.familyId, device);
      throw new DomainError(
        'REFRESH_TOKEN_REUSED',
        'This session is no longer valid. Please sign in again.',
      );
    }

    await this.sessions.updateOne(
      { _id: session._id },
      { $set: { revokedAt: this.clock.now(), revokedReason: REVOKE_REASONS.Rotated } },
    );
    await this.audit.record({
      actorId: session.userId,
      action: AUDIT_ACTIONS.RefreshRotated,
      outcome: AUDIT_OUTCOMES.Success,
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
    });

    return this.sessionIssuer.issue(session.userId, device, { familyId: session.familyId });
  }

  private async revokeFamily(familyId: string, device: DeviceContext): Promise<void> {
    const result = await this.sessions.updateMany(
      { familyId, revokedAt: null },
      { $set: { revokedAt: this.clock.now(), revokedReason: REVOKE_REASONS.RefreshReuse } },
    );
    this.logger.warn({ familyId }, 'Refresh token reuse detected');
    await this.audit.record({
      actorId: null,
      action: AUDIT_ACTIONS.RefreshReuseDetected,
      outcome: AUDIT_OUTCOMES.Failure,
      context: { familyId, sessionsRevoked: result.modifiedCount },
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
    });
  }

  async logout(refreshToken: string): Promise<void> {
    const session = await this.sessions
      .findOneAndUpdate(
        { tokenHash: this.tokens.hashRefreshToken(refreshToken), revokedAt: null },
        { $set: { revokedAt: this.clock.now(), revokedReason: REVOKE_REASONS.Logout } },
      )
      .lean();
    if (session !== null) {
      await this.audit.record({
        actorId: session.userId,
        action: AUDIT_ACTIONS.Logout,
        outcome: AUDIT_OUTCOMES.Success,
      });
    }
  }

  async logoutEverywhere(userId: string): Promise<number> {
    const result = await this.sessions.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: this.clock.now(), revokedReason: REVOKE_REASONS.LogoutAll } },
    );
    await this.audit.record({
      actorId: userId,
      action: AUDIT_ACTIONS.LogoutAll,
      outcome: AUDIT_OUTCOMES.Success,
      context: { sessionsRevoked: result.modifiedCount },
    });
    return result.modifiedCount;
  }
}
