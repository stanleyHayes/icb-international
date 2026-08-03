import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { GENESIS_HASH } from '../audit.constants.js';
import { canonicalJson } from '../domain/canonicalise.js';
import { computeEventHash, type HashableAuditEvent } from '../domain/hash-chain.js';

function event(overrides: Partial<HashableAuditEvent> = {}): HashableAuditEvent {
  return {
    sequence: 0,
    actorType: 'staff',
    actorId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
    actorLabel: 'ops@icb.example',
    action: 'account.freeze',
    subjectType: 'accounts',
    subjectId: '01ARZ3NDEKTSV4RRFFQ69G5FB0',
    summary: 'account.freeze',
    before: null,
    after: { status: 'frozen' },
    changes: [{ field: 'status', before: '(absent)', after: 'frozen' }],
    ipAddress: null,
    correlationId: 'corr-1',
    at: new Date('2026-08-02T12:00:00.000Z'),
    ...overrides,
  };
}

describe('computeEventHash', () => {
  it('is deterministic for the same inputs', () => {
    expect(computeEventHash(null, event())).toBe(computeEventHash(null, event()));
  });

  it('hashes the genesis event against the genesis constant', () => {
    const expected = createHash('sha256')
      .update(
        `${GENESIS_HASH}\n${canonicalJson({
          sequence: 0,
          actorType: 'staff',
          actorId: '01ARZ3NDEKTSV4RRFFQ69G5FAV',
          actorLabel: 'ops@icb.example',
          action: 'account.freeze',
          subjectType: 'accounts',
          subjectId: '01ARZ3NDEKTSV4RRFFQ69G5FB0',
          summary: 'account.freeze',
          before: null,
          after: { status: 'frozen' },
          changes: [{ field: 'status', before: '(absent)', after: 'frozen' }],
          ipAddress: null,
          correlationId: 'corr-1',
          at: new Date('2026-08-02T12:00:00.000Z'),
        })}`,
        'utf8',
      )
      .digest('hex');
    expect(computeEventHash(null, event())).toBe(expected);
  });

  it('links to the previous hash — a different predecessor changes the hash', () => {
    const first = computeEventHash(null, event());
    const second = computeEventHash(first, event({ sequence: 1 }));
    expect(second).not.toBe(computeEventHash(null, event({ sequence: 1 })));
    expect(second).toBe(computeEventHash(first, event({ sequence: 1 })));
  });

  it('commits to the payload — any field change changes the hash', () => {
    const original = computeEventHash(null, event());
    expect(computeEventHash(null, event({ summary: 'forged' }))).not.toBe(original);
    expect(computeEventHash(null, event({ sequence: 1 }))).not.toBe(original);
  });
});
