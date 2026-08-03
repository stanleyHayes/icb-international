import type { AccountStatus } from '@icb/contracts';

import { AccountTransitionError } from './account.errors.js';

/**
 * The account status state machine.
 *
 * `closed` is terminal — a bank account is never reopened, because its number and IBAN may be
 * recycled and history must stay attached to one lifecycle. Everything else can return to
 * `active`; only an active account can be frozen or go dormant, which is what stops a fraud
 * freeze being quietly "unfrozen" out of a pending application.
 */
const ALLOWED_TRANSITIONS: Readonly<Record<AccountStatus, readonly AccountStatus[]>> = {
  pending: ['active', 'closed'],
  active: ['frozen', 'dormant', 'closed'],
  frozen: ['active', 'closed'],
  dormant: ['active', 'closed'],
  closed: [],
};

export function isTransitionAllowed(from: AccountStatus, to: AccountStatus): boolean {
  return from === to || ALLOWED_TRANSITIONS[from].includes(to);
}

/** Throw unless `from → to` is a legal move. Setting the current status again is a no-op. */
export function assertTransition(
  accountId: string,
  from: AccountStatus,
  to: AccountStatus,
): void {
  if (!isTransitionAllowed(from, to)) {
    throw new AccountTransitionError(accountId, from, to);
  }
}
