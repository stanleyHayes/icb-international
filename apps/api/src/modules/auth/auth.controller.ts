import {
  loginRequestSchema,
  registerRequestSchema,
  type AuthenticatedUser,
  type AuthTokens,
} from '@icb/contracts';
import { Body, Controller, Get, Inject, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { DomainError } from '../../common/errors/domain.error.js';
import { zodBody } from '../../common/pipes/zod-validation.pipe.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { AuthService, type DeviceContext, type IssuedSession } from './auth.service.js';
import { REFRESH_COOKIE_NAME } from './auth.constants.js';
import type { AccessTokenClaims } from './application/token.service.js';

interface AuthResponse {
  tokens: AuthTokens;
  user: AuthenticatedUser;
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @Inject(CONFIG) private readonly config: AppConfiguration,
  ) {}

  @Public()
  @Post('register')
  async register(
    @Body(zodBody(registerRequestSchema)) body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const issued = await this.auth.register(
      registerRequestSchema.parse(body),
      readDevice(request),
    );
    return this.completeSession(issued, reply);
  }

  @Public()
  @Post('login')
  async login(
    @Body(zodBody(loginRequestSchema)) body: unknown,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const issued = await this.auth.login(loginRequestSchema.parse(body), readDevice(request));
    return this.completeSession(issued, reply);
  }

  @Public()
  @Post('refresh')
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AuthResponse> {
    const token = readRefreshCookie(request);
    const issued = await this.auth.refresh(token, readDevice(request));
    return this.completeSession(issued, reply);
  }

  @Public()
  @Post('logout')
  async logout(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<{ ok: true }> {
    const token = request.cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      await this.auth.logout(token);
    }
    void reply.clearCookie(REFRESH_COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  @Post('logout-all')
  async logoutEverywhere(@CurrentUser() user: AccessTokenClaims): Promise<{ revoked: number }> {
    return { revoked: await this.auth.logoutEverywhere(user.sub) };
  }

  @Get('me')
  async me(@CurrentUser() user: AccessTokenClaims): Promise<AuthenticatedUser> {
    return this.auth.currentUser(user.sub);
  }

  /**
   * The refresh token goes into an httpOnly, SameSite=Strict cookie and never into the response
   * body — so no script on the page can read it, and it is not stored anywhere JavaScript
   * reaches. The access token does go in the body, to be held in memory only.
   */
  private completeSession(issued: IssuedSession, reply: FastifyReply): AuthResponse {
    void reply.setCookie(REFRESH_COOKIE_NAME, issued.refreshToken, {
      httpOnly: true,
      secure: this.config.isProduction,
      sameSite: 'strict',
      path: '/',
      maxAge: Math.floor(issued.refreshTtlMs / 1000),
    });

    return {
      tokens: { accessToken: issued.accessToken, expiresIn: issued.expiresIn, tokenType: 'Bearer' },
      user: issued.user,
    };
  }
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
