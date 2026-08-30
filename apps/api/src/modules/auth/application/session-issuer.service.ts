import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { DomainError } from '../../../common/errors/domain.error.js';
import { newId } from '../../../infrastructure/database/identifier.js';
import { UserCredentialDoc } from '../../customers/infrastructure/customer.schemas.js';
import type { DeviceContext, IssuedSession } from './auth.types.js';
import { TokenService } from './token.service.js';
import { UserProfileReader } from './user-profile-reader.js';

export interface IssueOptions {
  /** Present when rotating: the new session joins the existing token family. */
  readonly familyId?: string;
}

/**
 * The single way a session comes into existence.
 *
 * Registration, login, and refresh rotation all funnel through here, so the
 * invariants — session row first, access token claims pointing at it — hold in exactly one
 * place.
 */
@Injectable()
export class SessionIssuer {
  constructor(
    @InjectModel(UserCredentialDoc.name) private readonly credentials: Model<UserCredentialDoc>,
    private readonly profiles: UserProfileReader,
    private readonly tokens: TokenService,
  ) {}

  async issue(userId: string, device: DeviceContext, options: IssueOptions = {}): Promise<IssuedSession> {
    const credential = await this.credentials.findById(userId).lean();
    if (!credential?.active) {
      throw new DomainError('INVALID_CREDENTIALS', 'Email or password is incorrect');
    }

    const sessionId = newId();
    const refresh = this.tokens.createRefreshToken();

    await this.profiles.recordSession({
      sessionId,
      userId: credential._id,
      refresh,
      device,
      familyId: options.familyId,
    });

    const user = await this.profiles.toAuthenticatedUser(credential);
    const access = await this.tokens.issueAccessToken({
      sub: credential._id,
      customerId: credential.customerId,
      email: credential.email,
      roles: credential.roles,
      sessionId,
    });

    return {
      accessToken: access.token,
      expiresIn: access.expiresIn,
      refreshToken: refresh.token,
      refreshTtlMs: refresh.ttlMs,
      user,
    };
  }
}
