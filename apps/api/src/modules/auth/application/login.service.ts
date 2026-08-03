import type { LoginRequest, MfaChallenge, MfaVerifyRequest } from '@icb/contracts';
import { Injectable } from '@nestjs/common';

import { AUDIT_ACTIONS } from '../auth.constants.js';
import { describeDevice } from '../domain/device-label.js';
import { AUDIT_OUTCOMES, AuditPort } from './audit.port.js';
import type { DeviceContext, IssuedSession } from './auth.types.js';
import { CredentialVerifier } from './credential-verifier.service.js';
import { MfaChallengeService } from './mfa-challenge.service.js';
import { SessionIssuer } from './session-issuer.service.js';
import { TrustedDeviceService } from './trusted-device.service.js';
import { UserProfileReader } from './user-profile-reader.js';

export type LoginOutcome =
  | { readonly outcome: 'authenticated'; readonly session: IssuedSession }
  | { readonly outcome: 'mfa_required'; readonly challenge: MfaChallenge };

/**
 * The login decision tree.
 *
 * Password first (with lockout), then the second factor — skipped entirely when the device is
 * already trusted. A completed MFA challenge carries the device context of the original
 * attempt, so the session it produces still names the browser and IP that started the login.
 */
@Injectable()
export class LoginService {
  constructor(
    private readonly verifier: CredentialVerifier,
    private readonly challenges: MfaChallengeService,
    private readonly trustedDevices: TrustedDeviceService,
    private readonly sessionIssuer: SessionIssuer,
    private readonly profiles: UserProfileReader,
    private readonly audit: AuditPort,
  ) {}

  async login(request: LoginRequest, device: DeviceContext): Promise<LoginOutcome> {
    const credential = await this.verifier.verify(request.email, request.password);
    const context: DeviceContext = { ...device, deviceId: request.deviceId ?? device.deviceId };

    if (await this.secondFactorNeeded(credential._id, credential.mfaEnabled, context.deviceId)) {
      const phone = await this.profiles.phoneForCustomer(credential.customerId);
      const challenge = await this.challenges.issue(credential, context, { phone });
      await this.audit.record({
        actorId: credential._id,
        action: AUDIT_ACTIONS.MfaChallengeIssued,
        outcome: AUDIT_OUTCOMES.Success,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      return { outcome: 'mfa_required', challenge };
    }

    const session = await this.sessionIssuer.issue(credential._id, context, {
      trusted: context.deviceId !== null,
    });
    await this.auditLogin(credential._id, context);
    return { outcome: 'authenticated', session };
  }

  /** Completes a login that was paused for MFA; optionally trusts the device for next time. */
  async verifyMfa(request: MfaVerifyRequest): Promise<IssuedSession> {
    const verified = await this.challenges.verify(request.challengeId, request.code);

    if (request.trustDevice && verified.deviceId !== null) {
      await this.trustedDevices.trust({
        userId: verified.userId,
        deviceId: verified.deviceId,
        label: describeDevice(verified.userAgent),
      });
      await this.audit.record({
        actorId: verified.userId,
        action: AUDIT_ACTIONS.DeviceTrusted,
        outcome: AUDIT_OUTCOMES.Success,
      });
    }

    const session = await this.sessionIssuer.issue(
      verified.userId,
      { deviceId: verified.deviceId, userAgent: verified.userAgent, ipAddress: verified.ipAddress },
      { trusted: true },
    );
    await this.audit.record({
      actorId: verified.userId,
      action: verified.usedRecoveryCode ? AUDIT_ACTIONS.RecoveryCodeUsed : AUDIT_ACTIONS.Login,
      outcome: AUDIT_OUTCOMES.Success,
      ipAddress: verified.ipAddress,
      userAgent: verified.userAgent,
    });
    return session;
  }

  private async secondFactorNeeded(
    userId: string,
    mfaEnabled: boolean,
    deviceId: string | null,
  ): Promise<boolean> {
    if (!mfaEnabled) {
      return false;
    }
    if (deviceId === null) {
      return true;
    }
    return !(await this.trustedDevices.isTrusted(userId, deviceId));
  }

  private async auditLogin(userId: string, device: DeviceContext): Promise<void> {
    await this.audit.record({
      actorId: userId,
      action: AUDIT_ACTIONS.Login,
      outcome: AUDIT_OUTCOMES.Success,
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
    });
  }
}
