import type {
  AccountBalances,
  AccountDetail,
  AuthenticatedUser,
  LoginResponse,
} from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';
import { createAuthenticatedAgent, type AuthenticatedAgent } from '@icb/testing';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import request from 'supertest';
import { expect } from 'vitest';

/**
 * HTTP-level flow helpers shared by the integration specs.
 *
 * Everything goes through the wire — no service shortcuts — so a regression anywhere between
 * routing and the database fails here. Email addresses are deterministic per spec file
 * (`label`): each suite runs against a fresh database, so uniqueness only has to hold within
 * one file, and deterministic values keep failures reproducible.
 */

/**
 * The one fixture login every suite registers and authenticates with. Written as a phrase rather
 * than a token so it reads as test data — nothing here is a credential to any deployed system.
 */
export const CUSTOMER_PASSWORD = 'Tr7 Integration Password';
export const TERMS_VERSION = '2026-01';

export interface RegisteredCustomer {
  readonly email: string;
  readonly user: AuthenticatedUser;
}

export interface Session {
  readonly accessToken: string;
  /** Raw `icb_refresh=…` pair lifted from the Set-Cookie header, for replay tests. */
  readonly refreshCookie: string;
  readonly agent: AuthenticatedAgent;
}

type Server = Parameters<typeof request>[0];

function serverOf(app: NestFastifyApplication): Server {
  return app.getHttpServer();
}

/**
 * Set-Cookie in the shape the flows need. superagent types every header as a plain string, but
 * Node hands this one back as an array whenever a response sets more than one cookie.
 */
function setCookies(headers: Record<string, string>): string[] {
  const header: string | string[] | undefined = headers['set-cookie'];
  if (header === undefined) {
    return [];
  }
  return Array.isArray(header) ? header : [header];
}

/** Unauthenticated request, for flows that must not carry a token (register/login/refresh). */
export function anonymous(app: NestFastifyApplication): ReturnType<typeof request> {
  return request(serverOf(app));
}

/** Idempotency keys are scoped per label + name: unique per logical operation, stable on retry. */
export function idempotencyKey(label: string, name: string): string {
  return `qa03-${label}-${name}`;
}

export async function registerCustomer(
  app: NestFastifyApplication,
  label: string,
): Promise<RegisteredCustomer> {
  const email = `qa03.${label}@example.test`;
  const response = await request(serverOf(app))
    .post('/v1/auth/register')
    .send({
      email,
      password: CUSTOMER_PASSWORD,
      firstName: 'QA',
      lastName: 'Integration',
      phone: '+233201234567',
      acceptedTermsVersion: TERMS_VERSION,
    })
    .expect(201);
  return { email, user: response.body as AuthenticatedUser };
}

/** Login and lift the refresh cookie out of Set-Cookie; asserts the authenticated outcome. */
export async function login(
  app: NestFastifyApplication,
  email: string,
  password: string = CUSTOMER_PASSWORD,
): Promise<Session> {
  const response = await request(serverOf(app))
    .post('/v1/auth/login')
    .send({ email, password })
    .expect(200);

  const body = response.body as LoginResponse;

  const refreshCookie = setCookies(response.headers).find((cookie) =>
    cookie.startsWith('icb_refresh='),
  );
  if (refreshCookie === undefined) {
    throw new Error('Login did not set the refresh cookie');
  }

  return {
    accessToken: body.tokens.accessToken,
    refreshCookie: refreshCookie.split(';')[0] ?? refreshCookie,
    agent: createAuthenticatedAgent({ app, token: body.tokens.accessToken }),
  };
}

export interface OpenAccountOptions {
  readonly productCode?: string;
  readonly currency?: CurrencyCode;
  /** Integer minor units; omit for a zero-balance account. */
  readonly initialDepositMinorUnits?: number;
  readonly idempotencyKey: string;
}

export async function openAccount(
  agent: AuthenticatedAgent,
  options: OpenAccountOptions,
): Promise<AccountDetail> {
  const currency = options.currency ?? 'USD';
  const response = await agent
    .post('/v1/accounts')
    .set('Idempotency-Key', options.idempotencyKey)
    .send({
      productCode: options.productCode ?? 'ICB-CURRENT',
      currency,
      ...(options.initialDepositMinorUnits !== undefined
        ? {
            initialDeposit: {
              minorUnits: options.initialDepositMinorUnits,
              currency,
              scale: 2,
            },
          }
        : {}),
    })
    .expect(201);
  return response.body as AccountDetail;
}

/** Refresh the session by presenting the cookie exactly as a browser would. */
export async function refreshSession(
  app: NestFastifyApplication,
  refreshCookie: string,
): Promise<{ status: number; body: unknown; setCookie: string[] }> {
  const response = await request(serverOf(app))
    .post('/v1/auth/refresh')
    .set('Cookie', refreshCookie);
  return {
    status: response.status,
    body: response.body as unknown,
    setCookie: setCookies(response.headers),
  };
}

/**
 * The balance identity every read must satisfy: available = ledger − holds + agreed overdraft.
 * Asserting the relationship (rather than a hard-coded available figure) keeps the suite honest
 * about the invariant without depending on a product's configured overdraft limit.
 */
export function expectAvailableEqualsLedgerMinusHoldsPlusOverdraft(
  balances: AccountBalances,
): void {
  const expected =
    balances.ledger.minorUnits - balances.holds.minorUnits + balances.overdraftLimit.minorUnits;
  expect(balances.available.minorUnits).toBe(expected);
}
