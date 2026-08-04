import type { AuthenticatedUser } from '@icb/contracts';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../../common/errors/domain.error.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import { AuthController } from '../auth.controller.js';
import { REFRESH_COOKIE_NAME } from '../auth.constants.js';
import { type AuthService } from '../auth.service.js';
import type { IssuedSession } from '../application/auth.types.js';
import { type LoginService } from '../application/login.service.js';
import { type RegistrationService } from '../application/registration.service.js';
import type { AccessTokenClaims } from '../application/token.service.js';
import { type UserProfileReader } from '../application/user-profile-reader.js';

const USER = { id: 'user-1', email: 'ada@example.com' } as unknown as AuthenticatedUser;

const ISSUED: IssuedSession = {
  accessToken: 'access-token',
  expiresIn: 900,
  refreshToken: 'refresh-token',
  refreshTtlMs: 2_592_000_000,
  user: USER,
};

const CLAIMS = {
  sub: 'user-1',
  customerId: 'cust-1',
  email: 'ada@example.com',
  roles: ['customer'],
  sessionId: 'session-1',
} as AccessTokenClaims;

function requestDouble(overrides: Record<string, unknown> = {}): FastifyRequest {
  return {
    headers: { 'user-agent': 'Vitest Browser/1.0' },
    ip: '203.0.113.7',
    cookies: {},
    ...overrides,
  } as unknown as FastifyRequest;
}

function replyDouble(): { setCookie: ReturnType<typeof vi.fn>; clearCookie: ReturnType<typeof vi.fn> } {
  return { setCookie: vi.fn(), clearCookie: vi.fn() };
}

function setup(isProduction = false) {
  const registration = { register: vi.fn().mockResolvedValue(USER) };
  const logins = {
    login: vi.fn(),
    verifyMfa: vi.fn().mockResolvedValue(ISSUED),
  };
  const auth = {
    refresh: vi.fn().mockResolvedValue(ISSUED),
    logout: vi.fn().mockResolvedValue(undefined),
    logoutEverywhere: vi.fn().mockResolvedValue(undefined),
  };
  const profiles = { currentUser: vi.fn().mockResolvedValue(USER) };

  const controller = new AuthController(
    registration as unknown as RegistrationService,
    logins as unknown as LoginService,
    auth as unknown as AuthService,
    profiles as unknown as UserProfileReader,
    { isProduction } as unknown as AppConfiguration,
  );
  return { controller, registration, logins, auth, profiles };
}

describe('AuthController', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('registers with the device context read from the request', async () => {
    const body = { email: 'ada@example.com', password: 'correct horse' };

    const result = await deps.controller.register(
      body as never,
      requestDouble({ headers: {} }),
    );

    expect(deps.registration.register).toHaveBeenCalledWith(body, {
      deviceId: null,
      userAgent: 'unknown',
      ipAddress: '203.0.113.7',
    });
    expect(result).toBe(USER);
  });

  it('returns the MFA challenge without touching cookies when login requires a second factor', async () => {
    const challenge = { id: 'challenge-1', channel: 'totp' };
    deps.logins.login.mockResolvedValue({ outcome: 'mfa_required', challenge });
    const reply = replyDouble();

    const result = await deps.controller.login(
      { email: 'ada@example.com', password: 'x' },
      requestDouble(),
      reply as unknown as FastifyReply,
    );

    expect(result).toEqual({ outcome: 'mfa_required', challenge });
    expect(reply.setCookie).not.toHaveBeenCalled();
  });

  it('sets the refresh cookie and returns access tokens on a successful login', async () => {
    deps.logins.login.mockResolvedValue({ outcome: 'authenticated', session: ISSUED });
    const reply = replyDouble();

    const result = await deps.controller.login(
      { email: 'ada@example.com', password: 'x' },
      requestDouble(),
      reply as unknown as FastifyReply,
    );

    expect(reply.setCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, 'refresh-token', {
      httpOnly: true,
      secure: false,
      sameSite: 'strict',
      path: '/',
      maxAge: 2_592_000,
    });
    expect(result).toEqual({
      outcome: 'authenticated',
      tokens: { accessToken: 'access-token', expiresIn: 900, tokenType: 'Bearer' },
      user: USER,
    });
  });

  it('marks the refresh cookie secure in production', async () => {
    const prod = setup(true);
    prod.logins.login.mockResolvedValue({ outcome: 'authenticated', session: ISSUED });
    const reply = replyDouble();

    await prod.controller.login(
      { email: 'ada@example.com', password: 'x' },
      requestDouble(),
      reply as unknown as FastifyReply,
    );

    expect(reply.setCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'refresh-token',
      expect.objectContaining({ secure: true }),
    );
  });

  it('completes MFA by setting the cookie and returning the session body', async () => {
    const reply = replyDouble();

    const result = await deps.controller.verifyMfa(
      { challengeId: 'challenge-1', code: '123456' } as never,
      reply as unknown as FastifyReply,
    );

    expect(deps.logins.verifyMfa).toHaveBeenCalledWith({
      challengeId: 'challenge-1',
      code: '123456',
    });
    expect(reply.setCookie).toHaveBeenCalledWith(
      REFRESH_COOKIE_NAME,
      'refresh-token',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(result.tokens.accessToken).toBe('access-token');
    expect(result.user).toBe(USER);
  });

  it('rotates the refresh cookie from the incoming cookie on refresh', async () => {
    const reply = replyDouble();

    const result = await deps.controller.refresh(
      requestDouble({ cookies: { [REFRESH_COOKIE_NAME]: 'old-refresh' } }),
      reply as unknown as FastifyReply,
    );

    expect(deps.auth.refresh).toHaveBeenCalledWith('old-refresh', {
      deviceId: null,
      userAgent: 'Vitest Browser/1.0',
      ipAddress: '203.0.113.7',
    });
    expect(reply.setCookie).toHaveBeenCalledOnce();
    expect(result).toEqual({
      accessToken: 'access-token',
      expiresIn: 900,
      tokenType: 'Bearer',
    });
  });

  it('rejects a refresh with no session cookie', async () => {
    await expect(
      deps.controller.refresh(requestDouble(), replyDouble() as unknown as FastifyReply),
    ).rejects.toMatchObject({ code: 'SESSION_EXPIRED' });
    await expect(
      deps.controller.refresh(requestDouble(), replyDouble() as unknown as FastifyReply),
    ).rejects.toBeInstanceOf(DomainError);
    expect(deps.auth.refresh).not.toHaveBeenCalled();
  });

  it('revokes the presented session and always clears the cookie on logout', async () => {
    const reply = replyDouble();

    await deps.controller.logout(
      requestDouble({ cookies: { [REFRESH_COOKIE_NAME]: 'old-refresh' } }),
      reply as unknown as FastifyReply,
    );

    expect(deps.auth.logout).toHaveBeenCalledWith('old-refresh');
    expect(reply.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, { path: '/' });
  });

  it('clears the cookie without a service call when logout has no session cookie', async () => {
    const reply = replyDouble();

    await deps.controller.logout(requestDouble(), reply as unknown as FastifyReply);

    expect(deps.auth.logout).not.toHaveBeenCalled();
    expect(reply.clearCookie).toHaveBeenCalledWith(REFRESH_COOKIE_NAME, { path: '/' });
  });

  it('logs out everywhere for the token subject', async () => {
    await deps.controller.logoutEverywhere(CLAIMS);

    expect(deps.auth.logoutEverywhere).toHaveBeenCalledWith('user-1');
  });

  it('answers /me from the profile reader', async () => {
    const result = await deps.controller.me(CLAIMS);

    expect(deps.profiles.currentUser).toHaveBeenCalledWith('user-1');
    expect(result).toBe(USER);
  });
});
