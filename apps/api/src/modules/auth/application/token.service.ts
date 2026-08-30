import { createHash, randomBytes } from 'node:crypto';

import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';

export interface AccessTokenClaims {
  readonly sub: string;
  readonly customerId: string | null;
  readonly email: string;
  readonly roles: readonly string[];
  readonly sessionId: string;
}

/**
 * Token issuance.
 *
 * Access tokens are short-lived JWTs held in memory by the client. Refresh tokens are opaque
 * random strings stored *hashed* server-side and delivered in an httpOnly cookie — so a database
 * leak yields nothing usable, and a script injected into the page cannot read them.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(CONFIG) private readonly config: AppConfiguration,
    private readonly clock: ClockService,
  ) {}

  async issueAccessToken(claims: AccessTokenClaims): Promise<{ token: string; expiresIn: number }> {
    const token = await this.jwt.signAsync(
      { ...claims, typ: 'access' },
      {
        secret: this.config.jwt.accessSecret,
        expiresIn: this.config.jwt.accessTtlSeconds,
        issuer: 'icb',
        audience: 'icb-clients',
      },
    );
    return { token, expiresIn: this.config.jwt.accessTtlSeconds };
  }

  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    return this.jwt.verifyAsync<AccessTokenClaims>(token, {
      secret: this.config.jwt.accessSecret,
      issuer: 'icb',
      audience: 'icb-clients',
    });
  }

  /**
   * A refresh token is opaque, not a JWT: it carries no claims, so it cannot be read, and its
   * only meaning is "this exact string matches a live session row".
   */
  createRefreshToken(): { token: string; hash: string; expiresAt: Date; ttlMs: number } {
    const token = randomBytes(48).toString('base64url');
    const ttlMs = this.config.jwt.refreshTtlSeconds * 1000;
    return {
      token,
      hash: this.hashRefreshToken(token),
      // Only used for the cookie's Max-Age; the authoritative expiry is stored on the session.
      expiresAt: new Date(this.clock.epochMs() + ttlMs),
      ttlMs,
    };
  }

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
