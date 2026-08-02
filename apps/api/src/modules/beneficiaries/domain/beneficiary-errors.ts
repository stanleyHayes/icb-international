import type { Money } from '@icb/money';

import { DomainError } from '../../../common/errors/index.js';

/**
 * The two ways a saved payee can refuse to be paid.
 *
 * Both are deliberate friction. Authorised-push-payment fraud works by adding a mule account to
 * a hijacked session and emptying the balance in a single move; a cap that expires on its own and
 * a verification the attacker cannot complete are what turn that into a survivable incident.
 */

export class BeneficiaryCoolingOffError extends DomainError {
  constructor(beneficiaryId: string, attempted: Money, cap: Money, until: Date) {
    super(
      'BENEFICIARY_COOLING_OFF',
      'This payee was added recently. Larger payments unlock once the cooling-off window ends.',
      {
        context: {
          beneficiaryId,
          attemptedMinorUnits: attempted.minorUnits,
          capMinorUnits: cap.minorUnits,
          currency: cap.currency,
          coolingOffUntil: until.toISOString(),
        },
      },
    );
  }
}

export class BeneficiaryUnverifiedError extends DomainError {
  constructor(beneficiaryId: string, attempted: Money, cap: Money) {
    super(
      'BENEFICIARY_UNVERIFIED',
      'Verify this payee with the micro-deposits we sent before paying this amount.',
      {
        context: {
          beneficiaryId,
          attemptedMinorUnits: attempted.minorUnits,
          capMinorUnits: cap.minorUnits,
          currency: cap.currency,
        },
      },
    );
  }
}

/** A wrong micro-deposit amount. Carries the remaining budget so the UI can warn before the lock. */
export class MicroDepositMismatchError extends DomainError {
  constructor(beneficiaryId: string, attemptsRemaining: number) {
    super('BENEFICIARY_UNVERIFIED', 'Those amounts do not match the deposits we sent', {
      context: { beneficiaryId, attemptsRemaining },
    });
  }
}

/** Three wrong answers and verification is over; only support can reopen it. */
export class MicroDepositLockedError extends DomainError {
  constructor(beneficiaryId: string) {
    super(
      'BENEFICIARY_UNVERIFIED',
      'Verification for this payee is locked after too many incorrect attempts',
      { context: { beneficiaryId, locked: true } },
    );
  }
}
