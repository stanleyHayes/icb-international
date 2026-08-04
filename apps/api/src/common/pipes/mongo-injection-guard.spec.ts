import { z } from 'zod';
import { describe, expect, it } from 'vitest';

import { assertNoMongoOperatorKeys } from './mongo-injection-guard.js';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const schema = z.object({ email: z.email() });

function expectRejected(value: unknown, path: string): void {
  expect(() => assertNoMongoOperatorKeys(value)).toThrow(
    expect.objectContaining({
      code: 'VALIDATION_FAILED',
      fieldErrors: [expect.objectContaining({ path })],
    }) as Error,
  );
}

describe('assertNoMongoOperatorKeys', () => {
  it('accepts an ordinary payload', () => {
    expect(() =>
      assertNoMongoOperatorKeys({ email: 'a@b.co', tags: ['x', 'y'], nested: { ok: 1 } }),
    ).not.toThrow();
  });

  it('accepts $ and . inside string *values* — they are data, not query syntax', () => {
    expect(() =>
      assertNoMongoOperatorKeys({ reference: 'invoice #42.1 — paid $100' }),
    ).not.toThrow();
  });

  it('rejects a nested operator object ({ email: { $gt: "" } })', () => {
    expectRejected({ email: { $gt: '' } }, 'email.$gt');
  });

  it('rejects a top-level operator key', () => {
    expectRejected({ $where: 'this.password.length > 0' }, '$where');
  });

  it('rejects a dot-notation key aimed at a $set path', () => {
    expectRejected({ 'profile.role': 'admin' }, 'profile.role');
  });

  it('rejects the Fastify-flat key a ?email[$gt]= querystring produces', () => {
    // fast-querystring does not nest brackets; the attack arrives as one literal key.
    expectRejected({ 'email[$gt]': '' }, 'email[$gt]');
  });

  it('rejects operator keys buried in arrays', () => {
    expectRejected({ items: [{ ok: 1 }, { $ne: null }] }, 'items[1].$ne');
  });

  it('rejects a __proto__ own key from a parsed JSON body', () => {
    expectRejected(JSON.parse('{"__proto__": {"isAdmin": true}}') as unknown, '__proto__');
  });

  it('rejects dangerous keys at any depth', () => {
    expectRejected({ a: { b: { c: { 'x.y': 1 } } } }, 'a.b.c.x.y');
  });
});

describe('ZodValidationPipe + operator guard', () => {
  it('rejects an operator payload before the schema runs, as VALIDATION_FAILED (400)', () => {
    const pipe = new ZodValidationPipe(schema);

    expect(() => pipe.transform({ email: { $gt: '' } })).toThrow(
      expect.objectContaining({
        code: 'VALIDATION_FAILED',
        fieldErrors: [expect.objectContaining({ path: 'email.$gt' })],
      }) as Error,
    );
  });

  it('rejects a ?email[$gt]=-style query object even when the schema would strip it', () => {
    const pipe = new ZodValidationPipe(z.object({ email: z.string().optional() }));

    // Zod would silently strip the unknown key and let the request through; the guard 400s it.
    expect(() => pipe.transform({ 'email[$gt]': '' })).toThrow(
      expect.objectContaining({ code: 'VALIDATION_FAILED' }) as Error,
    );
  });

  it('still validates clean payloads normally', () => {
    const pipe = new ZodValidationPipe(schema);
    expect(pipe.transform({ email: 'a@b.co' })).toEqual({ email: 'a@b.co' });
  });
});
