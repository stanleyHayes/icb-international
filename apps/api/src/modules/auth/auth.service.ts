import type { AuthenticatedUser, LoginRequest, RegisterRequest } from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { DomainError } from '../../common/errors/domain.error.js';
import { ConflictError } from '../../common/errors/index.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { SessionDoc, UserCredentialDoc } from '../customers/infrastructure/customer.schemas.js';
import { PasswordService } from './application/password.service.js';
import { TokenService } from './application/token.service.js';
import {
  EMAIL_TOKEN_TTL_MS,
  LOCKOUT_LADDER_MS,
  MAX_FAILED_ATTEMPTS,
} from './auth.constants.js';
import { UserProfileReader } from './application/user-profile-reader.js';

export interface DeviceContext {
  readonly deviceId: string | null;
  readonly userAgent: string;
  readonly ipAddress: string;
}

export interface IssuedSession {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly refreshToken: string;
  readonly refreshTtlMs: number;
  readonly user: AuthenticatedUser;
}

/**
 * Registration, login, and session lifecycle.
 *
 * The two behaviours worth reading closely:
 *  - login failures are indistinguishable from the outside (unknown email and wrong password
 *    return the same error), so the endpoint cannot be used to enumerate customers;
 *  - refresh tokens rotate, and presenting a rotated token revokes the entire family, because
 *    the only way that happens is theft.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(UserCredentialDoc.name) private readonly credentials: Model<UserCredentialDoc>,
    @InjectModel(SessionDoc.name) private readonly sessions: Model<SessionDoc>,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly clock: ClockService,
    private readonly profiles: UserProfileReader,
  ) {}

  async register(request: RegisterRequest, device: DeviceContext): Promise<IssuedSession> {
    this.passwords.assertNotBreached(request.password);

    const email = request.email.toLowerCase();
    if (await this.credentials.exists({ email })) {
      throw new ConflictError('An account with this email already exists', { email });
    }

    const customerId = newId();
    await this.profiles.createCustomerRecord(customerId, email, request);
    await this.createCredentialRecord(customerId, email, request.password);

    this.logger.log({ customerId }, 'Customer registered');
    return this.issueSession(email, device);
  }

  private async createCredentialRecord(
    customerId: string,
    email: string,
    password: string,
  ): Promise<void> {
    const verification = this.passwords.createToken();
    await this.credentials.create([
      {
        _id: newId(),
        customerId,
        email,
        passwordHash: await this.passwords.hash(password),
        emailVerified: false,
        emailVerificationTokenHash: verification.hash,
        emailVerificationExpiresAt: new Date(this.clock.epochMs() + EMAIL_TOKEN_TTL_MS),
        roles: [],
        active: true,
      },
    ]);
  }

  async login(request: LoginRequest, device: DeviceContext): Promise<IssuedSession> {
    const email = request.email.toLowerCase();
    const credential = await this.credentials.findOne({ email }).lean();

    // Hash regardless of whether the user exists, so response time does not reveal it.
    const matches = credential
      ? await this.passwords.verify(credential.passwordHash, request.password)
      : await this.passwords.verify('$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA', request.password);

    if (!credential || !credential.active) {
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

    return this.issueSession(email, { ...device, deviceId: request.deviceId ?? device.deviceId });
  }

  /**
   * Rotate a refresh token.
   *
   * The presented token is revoked and replaced. If it was *already* revoked, someone is using a
   * copy — every session in that family is killed and the customer is forced to log in again.
   */
  async refresh(refreshToken: string, device: DeviceContext): Promise<IssuedSession> {
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const session = await this.sessions.findOne({ tokenHash }).lean();

    if (!session) {
      throw new DomainError('SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
    }

    if (session.revokedAt) {
      await this.sessions.updateMany(
        { familyId: session.familyId, revokedAt: null },
        { $set: { revokedAt: this.clock.now(), revokedReason: 'refresh_token_reuse' } },
      );
      this.logger.warn({ familyId: session.familyId }, 'Refresh token reuse detected');
      throw new DomainError(
        'REFRESH_TOKEN_REUSED',
        'This session is no longer valid. Please sign in again.',
      );
    }

    if (session.expiresAt.getTime() <= this.clock.epochMs()) {
      throw new DomainError('SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
    }

    const credential = await this.credentials.findById(session.userId).lean();
    if (!credential?.active) {
      throw new DomainError('SESSION_EXPIRED', 'Your session has expired. Please sign in again.');
    }

    await this.sessions.updateOne(
      { _id: session._id },
      { $set: { revokedAt: this.clock.now(), revokedReason: 'rotated' } },
    );

    return this.issueSession(credential.email, device, session.familyId);
  }

  async logout(refreshToken: string): Promise<void> {
    await this.sessions.updateOne(
      { tokenHash: this.tokens.hashRefreshToken(refreshToken), revokedAt: null },
      { $set: { revokedAt: this.clock.now(), revokedReason: 'logout' } },
    );
  }

  async logoutEverywhere(userId: string): Promise<number> {
    const result = await this.sessions.updateMany(
      { userId, revokedAt: null },
      { $set: { revokedAt: this.clock.now(), revokedReason: 'logout_all' } },
    );
    return result.modifiedCount;
  }

  async currentUser(userId: string): Promise<AuthenticatedUser> {
    const credential = await this.credentials.findById(userId).lean();
    if (!credential) {
      throw new DomainError('UNAUTHENTICATED', 'Session is no longer valid');
    }
    return this.profiles.toAuthenticatedUser(credential);
  }

  private async issueSession(
    email: string,
    device: DeviceContext,
    familyId?: string,
  ): Promise<IssuedSession> {
    const credential = await this.credentials.findOne({ email }).lean();
    if (!credential) {
      throw new DomainError('INVALID_CREDENTIALS', 'Email or password is incorrect');
    }

    const sessionId = newId();
    const refresh = this.tokens.createRefreshToken();

    await this.profiles.recordSession({ sessionId, userId: credential._id, refresh, device, familyId });

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

  private assertNotLocked(credential: Pick<UserCredentialDoc, 'lockedUntil'>): void {
    if (credential.lockedUntil && credential.lockedUntil.getTime() > this.clock.epochMs()) {
      const seconds = Math.ceil((credential.lockedUntil.getTime() - this.clock.epochMs()) / 1000);
      throw new DomainError(
        'ACCOUNT_LOCKED',
        `Too many failed attempts. Try again in ${seconds} seconds.`,
        { retryAfterSeconds: seconds },
      );
    }
  }

  /** Each lockout lasts longer than the last, so brute force degrades to uselessness. */
  private async recordFailure(credential: Pick<UserCredentialDoc, '_id' | 'failedAttempts'>): Promise<void> {
    const attempts = credential.failedAttempts + 1;
    const update: Record<string, unknown> = { failedAttempts: attempts };

    if (attempts >= MAX_FAILED_ATTEMPTS) {
      const step = Math.min(attempts - MAX_FAILED_ATTEMPTS, LOCKOUT_LADDER_MS.length - 1);
      const duration = LOCKOUT_LADDER_MS[step] ?? LOCKOUT_LADDER_MS[LOCKOUT_LADDER_MS.length - 1] ?? 60_000;
      update['lockedUntil'] = new Date(this.clock.epochMs() + duration);
    }

    await this.credentials.updateOne({ _id: credential._id }, { $set: update });
  }
}
