import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { DomainError } from '../../../common/errors/domain.error.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { UserCredentialDoc } from '../../customers/infrastructure/customer.schemas.js';
import { AUDIT_ACTIONS, RESET_TOKEN_TTL_MS, REVOKE_REASONS } from '../auth.constants.js';
import { AUDIT_OUTCOMES, AuditPort } from './audit.port.js';
import type { DeviceContext } from './auth.types.js';
import { AuthMailerService } from './auth-mailer.service.js';
import { PasswordService } from './password.service.js';
import { SessionManagerService } from './session-manager.service.js';

/**
 * Forgot / reset password.
 *
 * `forgotPassword` always succeeds from the outside — the response cannot reveal whether an
 * email is registered (enumeration). `resetPassword` is the full security reset: new hash,
 * lockout cleared, every session killed, because whoever resets a password must sign in fresh
 * everywhere.
 */
@Injectable()
export class PasswordResetService {
  constructor(
    @InjectModel(UserCredentialDoc.name) private readonly credentials: Model<UserCredentialDoc>,
    private readonly passwords: PasswordService,
    private readonly mailer: AuthMailerService,
    private readonly sessions: SessionManagerService,
    private readonly clock: ClockService,
    private readonly audit: AuditPort,
  ) {}

  async requestReset(email: string, device: DeviceContext): Promise<void> {
    const credential = await this.credentials.findOne({ email: email.toLowerCase() }).lean();
    if (!credential?.active) {
      return; // Same outward result whether or not the account exists.
    }

    const token = this.passwords.createToken();
    await this.credentials.updateOne(
      { _id: credential._id },
      {
        $set: {
          passwordResetTokenHash: token.hash,
          passwordResetExpiresAt: new Date(this.clock.epochMs() + RESET_TOKEN_TTL_MS),
        },
      },
    );
    await this.mailer.sendPasswordReset(credential.email, token.token);
    await this.audit.record({
      actorId: credential._id,
      action: AUDIT_ACTIONS.PasswordResetRequested,
      outcome: AUDIT_OUTCOMES.Success,
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
    });
  }

  async resetPassword(token: string, newPassword: string, device: DeviceContext): Promise<void> {
    const credential = await this.credentials
      .findOne({ passwordResetTokenHash: this.passwords.hashToken(token) })
      .lean();

    if (!this.tokenValid(credential)) {
      throw new DomainError('VALIDATION_FAILED', 'This reset link is invalid or has expired.');
    }
    this.passwords.assertNotBreached(newPassword);

    await this.credentials.updateOne(
      { _id: credential._id },
      {
        $set: {
          passwordHash: await this.passwords.hash(newPassword),
          passwordResetTokenHash: null,
          passwordResetExpiresAt: null,
          failedAttempts: 0,
          lockedUntil: null,
        },
      },
    );
    await this.sessions.revokeAll(credential._id, REVOKE_REASONS.PasswordReset);
    await this.mailer.sendPasswordChangedNotice(credential.email);
    await this.audit.record({
      actorId: credential._id,
      action: AUDIT_ACTIONS.PasswordResetCompleted,
      outcome: AUDIT_OUTCOMES.Success,
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
    });
  }

  private tokenValid(
    credential: Pick<UserCredentialDoc, 'passwordResetExpiresAt'> | null,
  ): credential is UserCredentialDoc {
    return (
      credential !== null &&
      credential.passwordResetExpiresAt !== null &&
      credential.passwordResetExpiresAt.getTime() > this.clock.epochMs()
    );
  }
}
