import { describe, expect, it } from 'vitest';

import { REDACTED_VALUE } from './redaction.constants.js';
import { redactPii } from './redact.js';

describe('redactPii', () => {
  it('redacts every §11 sensitive key', () => {
    const input = {
      pan: '4111111111111111',
      cvv: '123',
      password: 'hunter2',
      token: 'abc',
      authorization: 'Bearer xyz',
      dob: '1990-01-01',
      nationalId: 'GH-123',
    };
    const result = redactPii(input) as Record<string, unknown>;

    for (const key of Object.keys(input)) {
      expect(result[key]).toBe(REDACTED_VALUE);
    }
  });

  it('matches case-insensitively and as a suffix', () => {
    const result = redactPii({ Password: 'x', accessToken: 'y', cardCvv: 'z' }) as Record<
      string,
      unknown
    >;

    expect(result).toEqual({ Password: REDACTED_VALUE, accessToken: REDACTED_VALUE, cardCvv: REDACTED_VALUE });
  });

  it('recurses into nested objects and arrays', () => {
    const result = redactPii({
      card: { pan: '4111', brand: 'visa' },
      payees: [{ name: 'Ada', token: 't' }],
    }) as { card: Record<string, unknown>; payees: Record<string, unknown>[] };

    expect(result.card).toEqual({ pan: REDACTED_VALUE, brand: 'visa' });
    expect(result.payees[0]).toEqual({ name: 'Ada', token: REDACTED_VALUE });
  });

  it('leaves ordinary fields untouched', () => {
    const input = { amount: 1250, currency: 'USD', reference: 'rent' };
    expect(redactPii(input)).toEqual(input);
  });

  it('passes primitives through', () => {
    expect(redactPii('hello')).toBe('hello');
    expect(redactPii(42)).toBe(42);
    expect(redactPii(null)).toBeNull();
  });

  it('does not mutate the input', () => {
    const input = { credentials: { password: 'p' } };
    redactPii(input);
    expect(input.credentials.password).toBe('p');
  });

  it('stops recursing past the depth cap', () => {
    let deep: Record<string, unknown> = { value: 'bottom' };
    for (let i = 0; i < 20; i += 1) {
      deep = { next: deep };
    }
    expect(() => redactPii(deep)).not.toThrow();
  });
});
