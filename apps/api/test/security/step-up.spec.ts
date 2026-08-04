import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { TokenService } from '../../src/modules/auth/application/token.service.js';
import { PAN_REVEAL_PURPOSE } from '../../src/modules/cards/application/card-security.service.js';
import { HIGH_VALUE_TRANSFER_PURPOSE } from '../../src/modules/transfers/application/transfer-step-up.service.js';
import { bootSecurityApp, SKIP_MESSAGE, type SecurityTestApp } from './harness/app-harness.js';
import { seedCustomer, type TestIdentity } from './harness/identities.js';
import { seedFundedAccounts } from './harness/resources.js';
import { seedCard } from './harness/seed-money.js';

const STEP_UP_HEADER = 'x-step-up-token';
const money = (minorUnits: number) => ({ minorUnits, currency: 'GHS', scale: 2 });
/** 20,000.00 GHS — above the 10,000-major-unit step-up threshold, under the internal rail cap. */
const HIGH_VALUE_MINOR_UNITS = 2_000_000;

interface StepUpContext {
  readonly ownerToken: string;
  readonly attackerToken: string;
  readonly cardId: string;
  readonly accountId: string;
  readonly secondAccountId: string;
}

/**
 * Step-up enforcement (agent_plan.md §11): PAN reveal and high-value transfers must demand a
 * fresh second factor bound to the caller AND to the operation's purpose.
 */
describe('SEC-02 step-up — PAN reveal and high-value transfer', () => {
  let handle: SecurityTestApp | null = null;
  let tokens: TokenService;
  let owner: TestIdentity;
  let attacker: TestIdentity;
  let ctx: StepUpContext;

  beforeAll(async () => {
    handle = await bootSecurityApp('stepup');
    if (!handle) {
      return;
    }
    tokens = handle.app.get(TokenService);
    owner = await seedCustomer(handle.connection, { email: 'owner@stepup.sec02.test', firstName: 'Ada', lastName: 'Owner' });
    attacker = await seedCustomer(handle.connection, { email: 'attacker@stepup.sec02.test', firstName: 'Mallory', lastName: 'Attacker' });
    const funded = await seedFundedAccounts(handle.app, owner.customerId as string);
    const cardId = await seedCard(handle.connection, { customerId: owner.customerId as string, accountId: funded.accountId, secondAccountId: funded.secondAccountId });
    ctx = { ownerToken: owner.accessToken, attackerToken: attacker.accessToken, cardId, ...funded };
  }, 300_000);

  afterAll(async () => {
    await handle?.close();
  });

  function call() {
    return request(handle?.app.getHttpServer() as Parameters<typeof request>[0]);
  }

  async function stepUpToken(userId: string, purpose: string): Promise<string> {
    const issued = await tokens.issueStepUpToken({ sub: userId, purpose });
    return issued.token;
  }

  describe('PAN reveal', () => {
    function reveal(token: string | null, stepUp: string | null) {
      const test = call().get(`/v1/cards/${ctx.cardId}/sensitive`).set('Authorization', `Bearer ${token}`);
      return stepUp ? test.set(STEP_UP_HEADER, stepUp) : test;
    }

    it('rejects the request without a step-up token', async (context) => {
      if (!handle) context.skip(SKIP_MESSAGE);
      const response = await reveal(ctx.ownerToken, null);
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'STEP_UP_REQUIRED' });
    });

    it('rejects a malformed step-up token', async (context) => {
      if (!handle) context.skip(SKIP_MESSAGE);
      const response = await reveal(ctx.ownerToken, 'not-a-jwt');
      expect(response.status).toBe(401);
    });

    it('rejects another customer\'s step-up token (sub binding)', async (context) => {
      if (!handle) context.skip(SKIP_MESSAGE);
      const response = await reveal(ctx.ownerToken, await stepUpToken(attacker.userId, PAN_REVEAL_PURPOSE));
      expect(response.status).toBe(401);
    });

    it('rejects a step-up token minted for a different purpose (purpose isolation)', async (context) => {
      if (!handle) context.skip(SKIP_MESSAGE);
      const wrongPurpose = await stepUpToken(owner.userId, HIGH_VALUE_TRANSFER_PURPOSE);
      const response = await reveal(ctx.ownerToken, wrongPurpose);
      expect(
        response.status,
        'PAN reveal accepted a step-up token minted for high_value_transfer — ' +
          'CardSecurityService.assertStepUp never checks claims.purpose (see mission report, CRITICAL)',
      ).toBe(401);
    });

    it('control: owner with a fresh reveal-purpose token gets the PAN', async (context) => {
      if (!handle) context.skip(SKIP_MESSAGE);
      const response = await reveal(ctx.ownerToken, await stepUpToken(owner.userId, PAN_REVEAL_PURPOSE));
      expect(response.status, JSON.stringify(response.body).slice(0, 300)).toBe(200);
      expect(response.body).toMatchObject({ pan: '4242424242424242', cvv: '123' });
    });
  });

  describe('high-value transfer', () => {
    it('quote above the threshold is flagged requiresStepUp', async (context) => {
      if (!handle) context.skip(SKIP_MESSAGE);
      const response = await call()
        .post('/v1/transfers/quotes')
        .set('Authorization', `Bearer ${ctx.ownerToken}`)
        .set('Idempotency-Key', 'sec02-stepup-quote-flag')
        .send({ fromAccountId: ctx.accountId, destination: { kind: 'own_account', accountId: ctx.secondAccountId }, amount: money(HIGH_VALUE_MINOR_UNITS), amountSide: 'debit' });
      expect(response.status, JSON.stringify(response.body).slice(0, 300)).toBe(201);
      expect(response.body).toMatchObject({ requiresStepUp: true });
    });

    function createTransfer(quote: string, stepUp: string | null, label: string) {
      const test = call()
        .post('/v1/transfers')
        .set('Authorization', `Bearer ${ctx.ownerToken}`)
        .set('Idempotency-Key', `sec02-stepup-transfer-${label}`);
      if (stepUp) {
        test.set(STEP_UP_HEADER, stepUp);
      }
      return test.send({
        quoteId: quote,
        fromAccountId: ctx.accountId,
        destination: { kind: 'own_account', accountId: ctx.secondAccountId },
        amount: money(HIGH_VALUE_MINOR_UNITS),
      });
    }

    /** Each attempt gets its own quote: redemption is single-use, even when step-up rejects. */
    async function freshQuote(label: string): Promise<string> {
      const response = await call()
        .post('/v1/transfers/quotes')
        .set('Authorization', `Bearer ${ctx.ownerToken}`)
        .set('Idempotency-Key', `sec02-stepup-quote-${label}`)
        .send({ fromAccountId: ctx.accountId, destination: { kind: 'own_account', accountId: ctx.secondAccountId }, amount: money(HIGH_VALUE_MINOR_UNITS), amountSide: 'debit' });
      expect(response.status, JSON.stringify(response.body).slice(0, 300)).toBe(201);
      return response.body['quoteId'] as string;
    }

    it('rejects creation without a step-up token', async (context) => {
      if (!handle) context.skip(SKIP_MESSAGE);
      const response = await createTransfer(await freshQuote('missing'), null, 'missing');
      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({ code: 'STEP_UP_REQUIRED' });
    });

    it('rejects a step-up token minted for a different purpose', async (context) => {
      if (!handle) context.skip(SKIP_MESSAGE);
      const response = await createTransfer(await freshQuote('wrong-purpose'), await stepUpToken(owner.userId, PAN_REVEAL_PURPOSE), 'wrong-purpose');
      expect(response.status).toBe(401);
    });

    it('rejects another customer\'s step-up token', async (context) => {
      if (!handle) context.skip(SKIP_MESSAGE);
      const response = await createTransfer(await freshQuote('foreign'), await stepUpToken(attacker.userId, HIGH_VALUE_TRANSFER_PURPOSE), 'foreign');
      expect(response.status).toBe(401);
    });

    it('control: valid step-up token allows the funded transfer through', async (context) => {
      if (!handle) context.skip(SKIP_MESSAGE);
      const response = await createTransfer(await freshQuote('control'), await stepUpToken(owner.userId, HIGH_VALUE_TRANSFER_PURPOSE), 'control');
      expect([200, 201], JSON.stringify(response.body).slice(0, 300)).toContain(response.status);
    });
  });
});
