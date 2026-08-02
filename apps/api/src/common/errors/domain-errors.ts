import type { Money } from '@icb/money';

import { DomainError } from './domain.error.js';

/**
 * Named errors for the situations the domain actually hits.
 *
 * Each one exists so that a call site reads as a sentence and so that the code, message, and
 * context travel together. Adding a bare `throw new Error(...)` anywhere in a module is a review
 * failure — the client would receive INTERNAL_ERROR for a business rule.
 */

export class NotFoundError extends DomainError {
  constructor(resource: string, identifier: string) {
    super('NOT_FOUND', `${resource} ${identifier} was not found`, {
      context: { resource, identifier },
    });
  }
}

export class ForbiddenError extends DomainError {
  constructor(reason: string, context: Record<string, unknown> = {}) {
    super('FORBIDDEN', reason, { context });
  }
}

export class ConflictError extends DomainError {
  constructor(reason: string, context: Record<string, unknown> = {}) {
    super('CONFLICT', reason, { context });
  }
}

export class InsufficientFundsError extends DomainError {
  constructor(accountId: string, requested: Money, available: Money) {
    super('INSUFFICIENT_FUNDS', 'The account does not have enough available balance', {
      context: {
        accountId,
        requestedMinorUnits: requested.minorUnits,
        availableMinorUnits: available.minorUnits,
        currency: requested.currency,
      },
    });
  }
}

export class AccountFrozenError extends DomainError {
  constructor(accountId: string) {
    super('ACCOUNT_FROZEN', 'This account is frozen and cannot be used for transactions', {
      context: { accountId },
    });
  }
}

export class AccountClosedError extends DomainError {
  constructor(accountId: string) {
    super('ACCOUNT_CLOSED', 'This account is closed', { context: { accountId } });
  }
}

export class LimitExceededError extends DomainError {
  constructor(limitName: string, limit: Money, attempted: Money) {
    super('LIMIT_EXCEEDED', `This transaction exceeds your ${limitName}`, {
      context: {
        limitName,
        limitMinorUnits: limit.minorUnits,
        attemptedMinorUnits: attempted.minorUnits,
        currency: limit.currency,
      },
    });
  }
}

export class LedgerUnbalancedError extends DomainError {
  constructor(currency: string, netMinorUnits: number) {
    super('LEDGER_UNBALANCED', 'Refusing to post an unbalanced transaction', {
      context: { currency, netMinorUnits },
    });
  }
}

export class StepUpRequiredError extends DomainError {
  constructor(purpose: string) {
    super('STEP_UP_REQUIRED', 'This action requires re-authentication', { context: { purpose } });
  }
}

export class KycTierInsufficientError extends DomainError {
  constructor(required: string, current: string | null) {
    super('KYC_TIER_INSUFFICIENT', `This action requires ${required} verification`, {
      context: { required, current },
    });
  }
}

export class RailRejectedError extends DomainError {
  constructor(rail: string, railCode: string, reason: string) {
    super('RAIL_REJECTED', reason, { context: { rail, railCode } });
  }
}

export class RateLimitedError extends DomainError {
  constructor(retryAfterSeconds: number) {
    super('RATE_LIMITED', 'Too many requests. Please wait before trying again.', {
      retryAfterSeconds,
    });
  }
}

export class ValidationError extends DomainError {
  constructor(message: string, fieldErrors: { path: string; message: string }[] = []) {
    super('VALIDATION_FAILED', message, { fieldErrors });
  }
}

/** A stored ciphertext could not be decrypted (wrong key, tampered, or corrupt). Carries no payload — the ciphertext itself is sensitive. */
export class DecryptionFailedError extends DomainError {
  constructor() {
    super('INTERNAL_ERROR', 'A stored value could not be decrypted');
  }
}
