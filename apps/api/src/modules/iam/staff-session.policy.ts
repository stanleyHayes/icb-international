import { Injectable } from '@nestjs/common';

import { DomainError } from '../../common/errors/index.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { STAFF_SESSION_POLICY } from './iam.constants.js';

/** The session facts the policy reasons about — satisfied by the auth module's session rows. */
export interface StaffSessionView {
  readonly lastSeenAt: Date;
  /** When the session family began (session row creation), for the absolute cap. */
  readonly startedAt: Date;
  readonly revokedAt: Date | null;
}

/**
 * Staff session policy.
 *
 * Operators get a shorter leash than customers: fifteen idle minutes ends the session even
 * when the refresh token is still technically alive, and eight hours ends it regardless.
 * The auth module (BE-04) owns session rows; this policy is the rulebook it enforces for
 * staff principals, kept here so the timeouts live next to the rest of IAM. All comparisons
 * go through ClockService, so a simulated clock jump expires staff sessions exactly as an
 * operator walking away would.
 */
@Injectable()
export class StaffSessionPolicy {
  constructor(private readonly clock: ClockService) {}

  /** The instant after which inactivity ends the session. */
  idleDeadline(lastSeenAt: Date): Date {
    return new Date(lastSeenAt.getTime() + STAFF_SESSION_POLICY.idleTimeoutMs);
  }

  /** The hard expiry of a session family, activity notwithstanding. */
  absoluteExpiry(startedAt: Date): Date {
    return new Date(startedAt.getTime() + STAFF_SESSION_POLICY.absoluteSessionMs);
  }

  isIdleExpired(session: StaffSessionView): boolean {
    return this.idleDeadline(session.lastSeenAt).getTime() <= this.clock.epochMs();
  }

  isExpired(session: StaffSessionView): boolean {
    return this.absoluteExpiry(session.startedAt).getTime() <= this.clock.epochMs();
  }

  /**
   * The forced re-authentication hook: throws unless the session is live, idle-fresh and
   * under its absolute cap. Callers treat the error as "sign in again".
   */
  assertActive(session: StaffSessionView): void {
    if (session.revokedAt !== null) {
      throw new DomainError('UNAUTHENTICATED', 'This staff session has been revoked');
    }
    if (this.isExpired(session)) {
      throw new DomainError('UNAUTHENTICATED', 'Staff sessions expire; please sign in again');
    }
    if (this.isIdleExpired(session)) {
      throw new DomainError('UNAUTHENTICATED', 'Staff session timed out; please sign in again');
    }
  }
}
