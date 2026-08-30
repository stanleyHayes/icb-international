import { describe, expect, it } from 'vitest';

import { REDACT_PATHS, scrubText } from '../redaction.js';

describe('log redaction paths', () => {
  it('covers every field the privacy notice promises to strip', () => {
    for (const field of [
      'password',
      'passwordHash',
      'pin',
      'pan',
      'cvv',
      'accessToken',
      'refreshToken',
      'tokenHash',
      'dateOfBirth',
      'nationalId',
    ]) {
      expect(REDACT_PATHS, `missing ${field}`).toContain(field);
    }
  });

  it('strips the authorization header', () => {
    expect(REDACT_PATHS).toContain('req.headers.authorization');
    expect(REDACT_PATHS).toContain('req.headers.cookie');
  });
});

describe('free-text scrubbing', () => {
  it('masks a card number wherever it appears in a message', () => {
    const scrubbed = scrubText('Authorisation failed for card 4539578763621486 at Palm Grove');
    expect(scrubbed).not.toContain('4539578763621486');
    expect(scrubbed).toContain('•••• 1486');
  });

  it('masks a grouped card number', () => {
    expect(scrubText('PAN 4539 5787 6362 1486 declined')).toContain('•••• 1486');
  });

  it('leaves a ten-digit account number alone', () => {
    // Account numbers are not secret and support needs to read them.
    expect(scrubText('Posting to account 1544819806')).toContain('1544819806');
  });

  it('removes a bearer token', () => {
    const scrubbed = scrubText('Rejected Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.abc.def');
    expect(scrubbed).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    expect(scrubbed).toContain('Bearer [redacted]');
  });

  it('partially masks an email so support can still recognise the customer', () => {
    const scrubbed = scrubText('Login failed for demo@icb.example');
    expect(scrubbed).not.toContain('demo@icb.example');
    expect(scrubbed).toContain('d•••@icb.example');
  });

  it('does not mangle the word "Bearer" in ordinary prose', () => {
    // This exact string is what the auth guard logs; the first version of the rule broke it.
    expect(scrubText('A Bearer token is required')).toBe('A Bearer token is required');
  });

  it('leaves ordinary prose untouched', () => {
    const message = 'Transfer TRF-VPDCKVKD completed on rail internal';
    expect(scrubText(message)).toBe(message);
  });
});
