import type { MfaChallenge } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { DomainError } from '../../../common/errors/domain.error.js';
import { newId } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { UserCredentialDoc } from '../../customers/infrastructure/customer.schemas.js';
import { MFA_CHALLENGE_TTL_MS, MFA_MAX_ATTEMPTS, SMS_OTP_LENGTH } from '../auth.constants.js';
import { generateNumericOtp, normaliseRecoveryCode } from '../domain/otp.js';
import { maskPhone } from '../domain/phone-mask.js';
import { MfaChallengeDoc } from '../infrastructure/auth.schemas.js';
import type { DeviceContext } from './auth.types.js';
import { PasswordService } from './password.service.js';
import { SmsOtpSender } from './sms-otp.sender.js';
import { TotpService } from './totp.service.js';

type ChallengeCredential = Pick<
  UserCredentialDoc,
  '_id' | 'email' | 'customerId' | 'mfaSecretEncrypted' | 'recoveryCodeHashes'
>;

export interface ChallengeOptions {
  /** Set for step-up: the sensitive operation the completed challenge authorises. */
  readonly purpose?: string;
  /** Destination for the simulated SMS OTP; required when no TOTP is enrolled. */
  readonly phone?: string | null;
}

export interface VerifiedChallenge {
  readonly userId: string;
  readonly purpose: string | null;
  readonly deviceId: string | null;
  readonly userAgent: string;
  readonly ipAddress: string;
  readonly usedRecoveryCode: boolean;
}

interface CodeCheck {
  readonly ok: boolean;
  readonly usedRecoveryCode: boolean;
}

/**
 * MFA challenges: a short-lived, single-use record that a code must be proven against.
 *
 * The method is chosen at issue time — authenticator when one is enrolled, the simulated SMS
 * rail otherwise. A TOTP challenge also accepts a recovery code, because "I lost my phone" must
 * not mean "I lost my account"; each recovery code works exactly once.
 */
@Injectable()
export class MfaChallengeService {
  constructor(
    @InjectModel(MfaChallengeDoc.name) private readonly challenges: Model<MfaChallengeDoc>,
    @InjectModel(UserCredentialDoc.name) private readonly credentials: Model<UserCredentialDoc>,
    private readonly totp: TotpService,
    private readonly passwords: PasswordService,
    private readonly sms: SmsOtpSender,
    private readonly clock: ClockService,
  ) {}

  async issue(
    credential: ChallengeCredential,
    device: DeviceContext,
    options: ChallengeOptions = {},
  ): Promise<MfaChallenge> {
    const method = credential.mfaSecretEncrypted === null ? 'sms' : 'totp';
    const expiresAt = new Date(this.clock.epochMs() + MFA_CHALLENGE_TTL_MS);
    const issued = method === 'sms' ? this.dispatchSmsCode(options.phone ?? null) : { codeHash: null };

    const challengeId = newId();
    await this.challenges.create([
      {
        _id: challengeId,
        userId: credential._id,
        method,
        codeHash: issued.codeHash,
        purpose: options.purpose ?? null,
        deviceId: device.deviceId,
        userAgent: device.userAgent,
        ipAddress: device.ipAddress,
        attempts: 0,
        expiresAt,
        consumedAt: null,
      },
    ]);

    return {
      challengeId,
      method,
      ...('hint' in issued ? { hint: issued.hint } : {}),
      expiresAt: expiresAt.toISOString(),
    };
  }

  /** Sends the code over the simulated rail and returns what is stored and what is hinted. */
  private dispatchSmsCode(phone: string | null): { codeHash: string; hint: string } {
    if (phone === null || phone.length === 0) {
      throw new DomainError(
        'MFA_REQUIRED',
        'No second factor is available on this account. Contact support.',
      );
    }
    const code = generateNumericOtp(SMS_OTP_LENGTH);
    this.sms.sendOtp(phone, code);
    return { codeHash: this.passwords.hashToken(code), hint: maskPhone(phone) };
  }

  async verify(challengeId: string, code: string): Promise<VerifiedChallenge> {
    const challenge = await this.challenges.findOne({ _id: challengeId }).lean();
    if (!this.isUsable(challenge)) {
      throw new DomainError('MFA_INVALID', 'This verification has expired. Please start again.');
    }
    const credential = await this.credentials.findById(challenge.userId).lean();
    if (!credential?.active) {
      throw new DomainError('MFA_INVALID', 'This verification has expired. Please start again.');
    }

    const check = this.checkCode(challenge, credential, code);
    if (!check.ok) {
      await this.registerFailure(challenge);
      throw new DomainError('MFA_INVALID', 'The code is incorrect');
    }

    await this.challenges.updateOne(
      { _id: challenge._id },
      { $set: { consumedAt: this.clock.now() } },
    );
    if (check.usedRecoveryCode) {
      await this.consumeRecoveryCode(credential._id, code);
    }

    return {
      userId: credential._id,
      purpose: challenge.purpose,
      deviceId: challenge.deviceId,
      userAgent: challenge.userAgent,
      ipAddress: challenge.ipAddress,
      usedRecoveryCode: check.usedRecoveryCode,
    };
  }

  private isUsable(challenge: MfaChallengeDoc | null): challenge is MfaChallengeDoc {
    return (
      challenge !== null &&
      challenge.consumedAt === null &&
      challenge.attempts < MFA_MAX_ATTEMPTS &&
      challenge.expiresAt.getTime() > this.clock.epochMs()
    );
  }

  private checkCode(
    challenge: MfaChallengeDoc,
    credential: ChallengeCredential,
    code: string,
  ): CodeCheck {
    if (challenge.method === 'sms') {
      const ok =
        challenge.codeHash !== null &&
        this.passwords.tokensMatch(this.passwords.hashToken(code.trim()), challenge.codeHash);
      return { ok, usedRecoveryCode: false };
    }
    if (
      credential.mfaSecretEncrypted !== null &&
      this.totp.check(this.totp.decryptSecret(credential.mfaSecretEncrypted), code)
    ) {
      return { ok: true, usedRecoveryCode: false };
    }
    return { ok: this.matchesRecoveryCode(credential, code), usedRecoveryCode: true };
  }

  private matchesRecoveryCode(credential: ChallengeCredential, code: string): boolean {
    const hash = this.passwords.hashToken(normaliseRecoveryCode(code));
    return credential.recoveryCodeHashes.some((stored) =>
      this.passwords.tokensMatch(hash, stored),
    );
  }

  /** Exhausted attempts consume the challenge, so a guessed code cannot be brute-forced. */
  private async registerFailure(challenge: MfaChallengeDoc): Promise<void> {
    const attempts = challenge.attempts + 1;
    await this.challenges.updateOne(
      { _id: challenge._id },
      {
        $set: {
          attempts,
          ...(attempts >= MFA_MAX_ATTEMPTS ? { consumedAt: this.clock.now() } : {}),
        },
      },
    );
  }

  private async consumeRecoveryCode(userId: string, code: string): Promise<void> {
    await this.credentials.updateOne(
      { _id: userId },
      { $pull: { recoveryCodeHashes: this.passwords.hashToken(normaliseRecoveryCode(code)) } },
    );
  }
}
