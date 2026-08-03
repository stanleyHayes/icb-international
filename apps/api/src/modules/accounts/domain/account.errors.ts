import type { AccountStatus } from '@icb/contracts';
import type { Money } from '@icb/money';

import { DomainError } from '../../../common/errors/index.js';

/**
 * The ways an account lifecycle operation can be refused.
 *
 * Codes come from the closed set in `@icb/contracts` — a client switches on `code`, so the rule
 * that fired (empty-account, transition, limit) must be distinguishable without reading prose.
 */

/** Close was requested against an account that still holds value or outstanding holds. */
export class AccountNotEmptyError extends DomainError {
  constructor(accountId: string, ledger: Money, holds: Money) {
    super(
      'ACCOUNT_NOT_EMPTY',
      'The account still has a balance. Provide a sweep destination or empty it first.',
      {
        context: {
          accountId,
          ledgerMinorUnits: ledger.minorUnits,
          holdMinorUnits: holds.minorUnits,
          currency: ledger.currency,
        },
      },
    );
  }
}

/** A status change the account state machine does not permit, e.g. closed → active. */
export class AccountTransitionError extends DomainError {
  constructor(accountId: string, from: AccountStatus, to: AccountStatus) {
    super('CONFLICT', `An account cannot move from ${from} to ${to}`, {
      context: { accountId, from, to },
    });
  }
}

/** A self-serve opening that would breach a per-customer account limit. */
export class AccountLimitExceededError extends DomainError {
  constructor(scope: string, limit: number) {
    super('LIMIT_EXCEEDED', `You cannot hold more than ${limit} ${scope}`, {
      context: { scope, limit },
    });
  }
}

/** A sweep destination or deposit in a different currency than the account. */
export class AccountCurrencyMismatchError extends DomainError {
  constructor(accountId: string, accountCurrency: string, otherCurrency: string) {
    super('ACCOUNT_CURRENCY_MISMATCH', 'The other account is in a different currency', {
      context: { accountId, accountCurrency, otherCurrency },
    });
  }
}
