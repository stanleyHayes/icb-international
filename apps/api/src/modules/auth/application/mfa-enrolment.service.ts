import { totpEnrolResponseSchema, type RecoveryCodes } from '@icb/contracts';
import type { z } from 'zod';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { DomainError } from '../../../common/errors/domain.error.js';
import { ConflictError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { UserCredentialDoc } from '../../customers/infrastructure/customer.schemas.js';
import { AUDIT_ACTIONS, RECOVERY_CODE_COUNT } from '../auth.constants.js';

type TotpEnrolResponse = z.infer<typeof totpEnrolResponseSchema>;
import { AUDIT_OUTCOMES, AuditPort } from './audit.port.js';
import { PasswordService } from './password.service.js';
import { TotpService } from './totp.service.js';

/**
 * TOTP enrolment, in two steps with a proof between them.
 *
 * `enrol` stores the secret but does not enable MFA — only `confirm`, which demands a working
 * code from the authenticator, flips the account over. That ordering is what stops a typo'd
 * scan from locking the customer out at their next login. Recovery codes are shown once, at
 * confirmation, and stored only as hashes.
 */
@Injectable()
export class MfaEnrolmentService {
  constructor(
    @InjectModel(UserCredentialDoc.name) private readonly credentials: Model<UserCredentialDoc>,
    private readonly totp: TotpService,
    private readonly passwords: PasswordService,
    private readonly clock: ClockService,
    private readonly audit: AuditPort,
  ) {}

  async enrol(userId: string): Promise<TotpEnrolResponse> {
    const credential = await this.load(userId);
    if (credential.mfaEnabled) {
      throw new ConflictError('Two-factor authentication is already enabled');
    }

    const secret = this.totp.generateSecret();
    await this.credentials.updateOne(
      { _id: userId },
      { $set: { mfaSecretEncrypted: this.totp.encryptSecret(secret) } },
    );

    const otpauthUri = this.totp.keyUri(credential.email, secret);
    return { secret, otpauthUri, qrCodeDataUri: await this.totp.qrCodeDataUri(otpauthUri) };
  }

  /** Enables MFA and returns the recovery codes — the only time they are ever visible. */
  async confirm(userId: string, code: string): Promise<RecoveryCodes> {
    const credential = await this.load(userId);
    if (credential.mfaEnabled) {
      throw new ConflictError('Two-factor authentication is already enabled');
    }
    const secret = this.pendingSecret(credential);
    if (!this.totp.check(secret, code)) {
      throw new DomainError('MFA_INVALID', 'The code is incorrect');
    }

    const recovery = this.passwords.createRecoveryCodes(RECOVERY_CODE_COUNT);
    await this.credentials.updateOne(
      { _id: userId },
      { $set: { mfaEnabled: true, recoveryCodeHashes: recovery.hashes } },
    );
    await this.audit.record({
      actorId: userId,
      action: AUDIT_ACTIONS.TotpEnrolled,
      outcome: AUDIT_OUTCOMES.Success,
    });
    return { codes: recovery.codes, generatedAt: this.clock.now().toISOString() };
  }

  /** Disabling demands a live TOTP code — a hijacked session alone cannot strip the account. */
  async disable(userId: string, code: string): Promise<void> {
    const credential = await this.load(userId);
    if (!credential.mfaEnabled || credential.mfaSecretEncrypted === null) {
      throw new DomainError('MFA_INVALID', 'Two-factor authentication is not enabled');
    }
    if (!this.totp.check(this.totp.decryptSecret(credential.mfaSecretEncrypted), code)) {
      throw new DomainError('MFA_INVALID', 'The code is incorrect');
    }

    await this.credentials.updateOne(
      { _id: userId },
      { $set: { mfaEnabled: false, mfaSecretEncrypted: null, recoveryCodeHashes: [] } },
    );
    await this.audit.record({
      actorId: userId,
      action: AUDIT_ACTIONS.TotpDisabled,
      outcome: AUDIT_OUTCOMES.Success,
    });
  }

  private async load(userId: string): Promise<UserCredentialDoc> {
    const credential = await this.credentials.findById(userId).lean();
    if (!credential?.active) {
      throw new DomainError('UNAUTHENTICATED', 'Session is no longer valid');
    }
    return credential;
  }

  private pendingSecret(credential: Pick<UserCredentialDoc, 'mfaSecretEncrypted'>): string {
    if (credential.mfaSecretEncrypted === null) {
      throw new DomainError('MFA_INVALID', 'Begin enrolment before confirming a code');
    }
    return this.totp.decryptSecret(credential.mfaSecretEncrypted);
  }
}
