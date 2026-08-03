import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { DomainError } from '../../../common/errors/domain.error.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { UserCredentialDoc } from '../../customers/infrastructure/customer.schemas.js';
import { AUDIT_ACTIONS, DUMMY_PASSWORD_HASH } from '../auth.constants.js';
import { lockoutDurationMs, lockoutRemainingSeconds } from '../domain/lockout.js';
import { AUDIT_OUTCOMES, AuditPort } from './audit.port.js';
import { PasswordService } from './password.service.js';

/**
 * Password verification with progressive lockout.
 *
 * The two behaviours worth reading closely:
 *  - failures are indistinguishable from the outside (unknown email and wrong password return
 *    the same error, and a hash is verified either way so response time does not reveal which);
 *  - every failure is recorded and audited, because a run of failures *is* the attack signal.
 */
@Injectable()
export class CredentialVerifier {
  constructor(
    @InjectModel(UserCredentialDoc.name) private readonly credentials: Model<UserCredentialDoc>,
    private readonly passwords: PasswordService,
    private readonly clock: ClockService,
    private readonly audit: AuditPort,
  ) {}

  /** Returns the credential on success; throws the same typed error for every failure mode. */
  async verify(email: string, password: string): Promise<UserCredentialDoc> {
    const credential = await this.credentials.findOne({ email: email.toLowerCase() }).lean();

    // Hash regardless of whether the user exists, so timing does not reveal it.
    const matches = credential
      ? await this.passwords.verify(credential.passwordHash, password)
      : await this.passwords.verify(DUMMY_PASSWORD_HASH, password);

    if (!credential?.active) {
      throw new DomainError('INVALID_CREDENTIALS', 'Email or password is incorrect');
    }
    this.assertNotLocked(credential);

    if (!matches) {
      await this.recordFailure(credential);
      throw new DomainError('INVALID_CREDENTIALS', 'Email or password is incorrect');
    }

    await this.credentials.updateOne(
      { _id: credential._id },
      { $set: { failedAttempts: 0, lockedUntil: null, lastLoginAt: this.clock.now() } },
    );
    return credential;
  }

  private assertNotLocked(credential: Pick<UserCredentialDoc, '_id' | 'lockedUntil'>): void {
    const remaining = lockoutRemainingSeconds(credential.lockedUntil, this.clock.epochMs());
    if (remaining > 0) {
      throw new DomainError(
        'ACCOUNT_LOCKED',
        `Too many failed attempts. Try again in ${remaining} seconds.`,
        { retryAfterSeconds: remaining },
      );
    }
  }

  private async recordFailure(
    credential: Pick<UserCredentialDoc, '_id' | 'failedAttempts'>,
  ): Promise<void> {
    const attempts = credential.failedAttempts + 1;
    const duration = lockoutDurationMs(attempts);

    await this.credentials.updateOne(
      { _id: credential._id },
      {
        $set: {
          failedAttempts: attempts,
          lockedUntil: duration === null ? null : new Date(this.clock.epochMs() + duration),
        },
      },
    );

    await this.audit.record({
      actorId: credential._id,
      action: AUDIT_ACTIONS.LoginFailed,
      outcome: AUDIT_OUTCOMES.Failure,
      context: { failedAttempts: attempts },
    });
  }
}
