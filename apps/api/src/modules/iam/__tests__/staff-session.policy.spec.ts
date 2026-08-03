import { beforeEach, describe, expect, it } from 'vitest';

import { DomainError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { STAFF_SESSION_POLICY } from '../iam.constants.js';
import { StaffSessionPolicy, type StaffSessionView } from '../staff-session.policy.js';

const START = new Date('2026-01-05T09:00:00.000Z');

describe('StaffSessionPolicy', () => {
  let clock: ClockService;
  let policy: StaffSessionPolicy;

  beforeEach(() => {
    clock = new ClockService();
    clock.freeze(START);
    policy = new StaffSessionPolicy(clock);
  });

  function session(overrides: Partial<StaffSessionView> = {}): StaffSessionView {
    return { lastSeenAt: START, startedAt: START, revokedAt: null, ...overrides };
  }

  it('derives the idle deadline from the last activity', () => {
    expect(policy.idleDeadline(START).getTime()).toBe(
      START.getTime() + STAFF_SESSION_POLICY.idleTimeoutMs,
    );
  });

  it('derives the absolute expiry from the session start', () => {
    expect(policy.absoluteExpiry(START).getTime()).toBe(
      START.getTime() + STAFF_SESSION_POLICY.absoluteSessionMs,
    );
  });

  it('accepts a live, recently-active session', () => {
    clock.advance(STAFF_SESSION_POLICY.idleTimeoutMs - 1);
    expect(() => policy.assertActive(session())).not.toThrow();
  });

  it('times out a session idle past the staff window', () => {
    clock.advance(STAFF_SESSION_POLICY.idleTimeoutMs);
    expect(policy.isIdleExpired(session())).toBe(true);
    expect(() => policy.assertActive(session())).toThrow(DomainError);
  });

  it('expires a session at its absolute cap even with fresh activity', () => {
    clock.advance(STAFF_SESSION_POLICY.absoluteSessionMs);
    const activeButOld = session({ lastSeenAt: clock.now() });
    expect(policy.isExpired(activeButOld)).toBe(true);
    expect(() => policy.assertActive(activeButOld)).toThrow(DomainError);
  });

  it('rejects a revoked session immediately', () => {
    expect(() => policy.assertActive(session({ revokedAt: START }))).toThrow(DomainError);
  });

  it('follows the simulated clock, not the wall', () => {
    clock.advance(20 * 60_000); // past the 15-minute idle window
    expect(policy.isIdleExpired(session())).toBe(true);
    clock.setTo(START); // an operator travelling back in time resurrects nothing decided
    expect(policy.isIdleExpired(session())).toBe(false);
  });
});
