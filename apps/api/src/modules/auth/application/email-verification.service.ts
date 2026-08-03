import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { DomainError } from '../../../common/errors/domain.error.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { UserCredentialDoc } from '../../customers/infrastructure/customer.schemas.js';
import { AUDIT_ACTIONS, EMAIL_TOKEN_TTL_MS } from '../auth.constants.js';
import { AUDIT_OUTCOMES, AuditPort } from './audit.port.js';
import { AuthMailerService } from './auth-mailer.service.js';
import { PasswordService } from './password.service.js';

/**
 * Email verification.
 *
 * The token is single-use, stored hashed, and expires — so a leaked database yields nothing
 * clickable and a leaked inbox link dies after 24 hours. Confirming an already-verified address
 * is a no-op shaped like success only when the token genuinely matches; anything else is the
 * same typed error, so the endpoint cannot be used to probe for live tokens.
 */
@Injectable()
export class EmailVerificationService {
  constructor(
    @InjectModel(UserCredentialDoc.name) private readonly credentials: Model<UserCredentialDoc>,
    private readonly passwords: PasswordService,
    private readonly mailer: AuthMailerService,
    private readonly clock: ClockService,
    private readonly audit: AuditPort,
  ) {}

  /** Issues a fresh token and delivers it. Re-issuing invalidates any previous token. */
  async issue(credentialId: string, email: string): Promise<void> {
    const token = this.passwords.createToken();
    await this.credentials.updateOne(
      { _id: credentialId },
      {
        $set: {
          emailVerificationTokenHash: token.hash,
          emailVerificationExpiresAt: new Date(this.clock.epochMs() + EMAIL_TOKEN_TTL_MS),
        },
      },
    );
    await this.mailer.sendEmailVerification(email, token.token);
    await this.audit.record({
      actorId: credentialId,
      action: AUDIT_ACTIONS.EmailVerificationSent,
      outcome: AUDIT_OUTCOMES.Success,
    });
  }

  async confirm(token: string): Promise<void> {
    const credential = await this.credentials
      .findOne({ emailVerificationTokenHash: this.passwords.hashToken(token) })
      .lean();

    if (!this.tokenValid(credential)) {
      throw new DomainError(
        'VALIDATION_FAILED',
        'This verification link is invalid or has expired.',
      );
    }

    await this.credentials.updateOne(
      { _id: credential._id },
      {
        $set: {
          emailVerified: true,
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
        },
      },
    );
    await this.audit.record({
      actorId: credential._id,
      action: AUDIT_ACTIONS.EmailVerified,
      outcome: AUDIT_OUTCOMES.Success,
    });
  }

  private tokenValid(
    credential: Pick<UserCredentialDoc, 'emailVerificationExpiresAt'> | null,
  ): credential is UserCredentialDoc {
    return (
      credential !== null &&
      credential.emailVerificationExpiresAt !== null &&
      credential.emailVerificationExpiresAt.getTime() > this.clock.epochMs()
    );
  }
}
