import { changePasswordRequestSchema } from '@icb/contracts';
import type { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { DomainError } from '../../../common/errors/domain.error.js';
import { UserCredentialDoc } from '../../customers/infrastructure/customer.schemas.js';
import { AUDIT_ACTIONS, REVOKE_REASONS } from '../auth.constants.js';

type ChangePasswordRequest = z.infer<typeof changePasswordRequestSchema>;
import { AUDIT_OUTCOMES, AuditPort } from './audit.port.js';
import { AuthMailerService } from './auth-mailer.service.js';
import { PasswordService } from './password.service.js';
import { SessionManagerService } from './session-manager.service.js';

/**
 * Authenticated password change.
 *
 * Knowing the current password is the authorisation — this is the one place a second factor is
 * not demanded, because a stolen session alone must not be enough to take over the account.
 * Every *other* session is revoked (the caller stays signed in) and trusted devices are dropped.
 */
@Injectable()
export class ChangePasswordService {
  constructor(
    @InjectModel(UserCredentialDoc.name) private readonly credentials: Model<UserCredentialDoc>,
    private readonly passwords: PasswordService,
    private readonly mailer: AuthMailerService,
    private readonly sessions: SessionManagerService,
    private readonly audit: AuditPort,
  ) {}

  async change(
    userId: string,
    currentSessionId: string,
    request: ChangePasswordRequest,
  ): Promise<void> {
    const credential = await this.credentials.findById(userId).lean();
    if (!credential?.active) {
      throw new DomainError('UNAUTHENTICATED', 'Session is no longer valid');
    }

    const matches = await this.passwords.verify(credential.passwordHash, request.currentPassword);
    if (!matches) {
      await this.audit.record({
        actorId: userId,
        action: AUDIT_ACTIONS.PasswordChanged,
        outcome: AUDIT_OUTCOMES.Failure,
      });
      throw new DomainError('INVALID_CREDENTIALS', 'The current password is incorrect');
    }
    this.passwords.assertNotBreached(request.newPassword);

    await this.credentials.updateOne(
      { _id: userId },
      { $set: { passwordHash: await this.passwords.hash(request.newPassword) } },
    );
    await this.sessions.revokeAll(userId, REVOKE_REASONS.PasswordChange, currentSessionId);
    await this.mailer.sendPasswordChangedNotice(credential.email);
    await this.audit.record({
      actorId: userId,
      action: AUDIT_ACTIONS.PasswordChanged,
      outcome: AUDIT_OUTCOMES.Success,
    });
  }
}
