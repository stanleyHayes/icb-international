import {
  stepUpVerifyRequestSchema,
  type MfaChallenge,
  type StepUpRequest,
  type StepUpToken,
} from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { z } from 'zod';

import { DomainError } from '../../../common/errors/domain.error.js';
import { UserCredentialDoc } from '../../customers/infrastructure/customer.schemas.js';
import { AUDIT_ACTIONS } from '../auth.constants.js';
import { AUDIT_OUTCOMES, AuditPort } from './audit.port.js';
import type { DeviceContext } from './auth.types.js';
import { MfaChallengeService } from './mfa-challenge.service.js';
import { TokenService } from './token.service.js';
import { UserProfileReader } from './user-profile-reader.js';

type StepUpVerifyRequest = z.infer<typeof stepUpVerifyRequestSchema>;

/**
 * Step-up authentication: a fresh second-factor proof for one sensitive operation.
 *
 * The challenge is an ordinary MFA challenge with a `purpose` pinned to it; completing it mints
 * a short-lived, single-purpose step-up token (`TokenService.issueStepUpToken`) that the global
 * `StepUpGuard` verifies on the sensitive endpoint. A login that happened an hour ago proves
 * identity; a step-up proves presence *now*, at the moment money or security settings move.
 */
@Injectable()
export class StepUpService {
  constructor(
    @InjectModel(UserCredentialDoc.name) private readonly credentials: Model<UserCredentialDoc>,
    private readonly challenges: MfaChallengeService,
    private readonly tokens: TokenService,
    private readonly profiles: UserProfileReader,
    private readonly audit: AuditPort,
  ) {}

  async request(
    userId: string,
    purpose: StepUpRequest['purpose'],
    device: DeviceContext,
  ): Promise<MfaChallenge> {
    const credential = await this.credentials.findById(userId).lean();
    if (!credential?.active) {
      throw new DomainError('UNAUTHENTICATED', 'Session is no longer valid');
    }

    const phone = await this.profiles.phoneForCustomer(credential.customerId);
    const challenge = await this.challenges.issue(credential, device, { purpose, phone });
    await this.audit.record({
      actorId: userId,
      action: AUDIT_ACTIONS.StepUpRequested,
      outcome: AUDIT_OUTCOMES.Success,
      context: { purpose },
      ipAddress: device.ipAddress,
      userAgent: device.userAgent,
    });
    return challenge;
  }

  async verify(userId: string, request: StepUpVerifyRequest): Promise<StepUpToken> {
    const verified = await this.challenges.verify(request.challengeId, request.code);
    if (verified.userId !== userId || verified.purpose === null) {
      throw new DomainError('MFA_INVALID', 'This challenge does not authorise a sensitive action');
    }

    const issued = await this.tokens.issueStepUpToken({ sub: userId, purpose: verified.purpose });
    await this.audit.record({
      actorId: userId,
      action: AUDIT_ACTIONS.StepUpVerified,
      outcome: AUDIT_OUTCOMES.Success,
      context: { purpose: verified.purpose },
    });
    return { stepUpToken: issued.token, expiresAt: issued.expiresAt.toISOString() };
  }
}
