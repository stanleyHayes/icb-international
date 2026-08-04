import { describe, expect, it } from 'vitest';

import { REDACTED_VALUE } from './redaction.constants.js';
import { redactPii } from './redact.js';

/**
 * SEC-04 regression pin — see docs/security/sec-04-audit.md (PII redaction).
 *
 * The contracts and the customer record name the field `dateOfBirth`, and a profile-update
 * body (`{ individual: { dateOfBirth } }`) nests it two levels deep. Both redaction layers
 * must catch it: `SENSITIVE_KEYS` carries `dateofbirth` for `redactPii`, and pino's
 * `REDACT_PATHS` carries `*.*.dateOfBirth` for the nested shape the interceptor logs.
 */
describe('redactPii §11 dateOfBirth (SEC-04)', () => {
  it('redacts dateOfBirth, the field name the contracts actually use', () => {
    const result = redactPii({ dateOfBirth: '1990-01-01' }) as Record<string, unknown>;

    expect(result.dateOfBirth).toBe(REDACTED_VALUE);
  });

  it('redacts dateOfBirth nested inside the individual profile block', () => {
    const result = redactPii({ individual: { firstName: 'Amara', dateOfBirth: '1990-01-01' } }) as {
      individual: Record<string, unknown>;
    };

    expect(result.individual.firstName).toBe('Amara');
    expect(result.individual.dateOfBirth).toBe(REDACTED_VALUE);
  });
});
