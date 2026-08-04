import {
  loginRequestSchema,
  mfaVerifyRequestSchema,
  registerRequestSchema,
  type AuthenticatedUser,
  type AuthTokens,
  type LoginRequest,
  type LoginResponse,
  type MfaVerifyRequest,
  type RegisterRequest,
} from '@icb/contracts';
import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { DomainError } from '../../common/errors/domain.error.js';
import { AUTH_THROTTLE_LIMIT, THROTTLE_WINDOW_MS } from '../../common/guards/throttle.constants.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { AuthService } from './auth.service.js';
import { REFRESH_COOKIE_NAME } from './auth.constants.js';
import type { DeviceContext, IssuedSession } from './application/auth.types.js';
import { LoginService } from './application/login.service.js';
import { RegistrationService } from './application/registration.service.js';
import type { AccessTokenClaims } from './application/token.service.js';
import { UserProfileReader } from './application/user-profile-reader.js';

interface MfaVerifyResponse {
  tokens: AuthTokens;
  user: AuthenticatedUser;
}

/**
 * Pre-auth credential endpoints get the tight auth ceiling: five attempts per minute per IP.
 * Credential stuffing and MFA guessing need volume; a human needs two or three tries.
 */
const AUTH_THROTTLE = { default: { limit: AUTH_THROTTLE_LIMIT, ttl: THROTTLE_WINDOW_MS } };

/**
 * Pre-auth flows: registration, login, MFA completion, and the refresh/logout cycle.
 *
 * The refresh token goes into an httpOnly, SameSite=Strict cookie and never into the response
 * body — so no script on the page can read it, and it is not stored anywhere JavaScript
 * reaches. The access token does go in the body, to be held in memory only.
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registration: RegistrationService,
    private readonly logins: LoginService,
    private readonly auth: AuthService,
    private readonly profiles: UserProfileReader,
    @Inject(CONFIG) private readonly config: AppConfiguration,
  ) {}

  @Public()
  @Post('register')
  @Throttle(AUTH_THROTTLE)
  register(
    @Body(zodBody(registerRequestSchema)) body: RegisterRequest,
    @Req() request: FastifyRequest,
  ): Promise<AuthenticatedUser> {
    return this.registration.register(body, readDevice(request));
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  async login(
    @Body(zodBody(loginRequestSchema)) body: LoginRequest,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<LoginResponse> {
    const outcome = await this.logins.login(body, readDevice(request));
    if (outcome.outcome === 'mfa_required') {
      return { outcome: 'mfa_required', challenge: outcome.challenge };
    }
    this.setRefreshCookie(reply, outcome.session);
    return { outcome: 'authenticated', ...sessionBody(outcome.session) };
  }

  @Public()
  @Post('mfa/verify')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  async verifyMfa(
    @Body(zodBody(mfaVerifyRequestSchema)) body: MfaVerifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<MfaVerifyResponse> {
    const issued = await this.logins.verifyMfa(body);
    this.setRefreshCookie(reply, issued);
    return sessionBody(issued);
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  @Throttle(AUTH_THROTTLE)
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthTokens> {
    const issued = await this.auth.refresh(readRefreshCookie(request), readDevice(request));
    this.setRefreshCookie(reply, issued);
    return sessionBody(issued).tokens;
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    const token = request.cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      await this.auth.logout(token);
    }
    void reply.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
  }

  @Post('logout-all')
  @HttpCode(204)
  async logoutEverywhere(@CurrentUser() user: AccessTokenClaims): Promise<void> {
    await this.auth.logoutEverywhere(user.sub);
  }

  @Get('me')
  me(@CurrentUser() user: AccessTokenClaims): Promise<AuthenticatedUser> {
    return this.profiles.currentUser(user.sub);
  }

  private setRefreshCookie(reply: FastifyReply, issued: IssuedSession): void {
    void reply.setCookie(REFRESH_COOKIE_NAME, issued.refreshToken, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: Math.floor(issued.refreshTtlMs / 1000),
    });
  }
}

function sessionBody(issued: IssuedSession): MfaVerifyResponse {
  return {
    tokens: {
      accessToken: issued.accessToken,
      expiresIn: issued.expiresIn,
      tokenType: 'Bearer',
    },
    user: issued.user,
  };
}

function readDevice(request: FastifyRequest): DeviceContext {
  const header = request.headers['user-agent'];
  return {
    deviceId: null,
    userAgent: typeof header === 'string' ? header : 'unknown',
    ipAddress: request.ip,
  };
}

function readRefreshCookie(request: FastifyRequest): string {
  const token = request.cookies?.[REFRESH_COOKIE_NAME];
  if (!token) {
    throw new DomainError('SESSION_EXPIRED', 'No active session. Please sign in.');
  }
  return token;
}
