import type { CaseStatus } from '@icb/contracts';

import { ValidationError } from '../../../common/errors/index.js';

/**
 * The case workflow, stated once.
 *
 * Work flows left to right: a case is opened, investigated, possibly escalated, and then either
 * closed (acted on, including a filed report) or dismissed (a human looked and said no). There
 * is no way back: a closed case that turns out to be wrong is a *new* case, because reopening
 * would rewrite the audit trail of the first decision.
 */
export const CASE_TRANSITIONS: Readonly<Record<CaseStatus, readonly CaseStatus[]>> = {
  open: ['investigating', 'escalated', 'closed', 'dismissed'],
  investigating: ['escalated', 'closed', 'dismissed'],
  escalated: ['closed', 'dismissed'],
  closed: [],
  dismissed: [],
};

/** Statuses that still need an analyst's time — the default queue filter. */
export const ACTIONABLE_STATUSES: readonly CaseStatus[] = ['open', 'investigating', 'escalated'];

/** A no-op status write is allowed (it just touches the case); anything else must be a real edge. */
export function assertTransition(from: CaseStatus, to: CaseStatus): void {
  if (from === to) {
    return;
  }
  if (!CASE_TRANSITIONS[from].includes(to)) {
    throw new ValidationError(`An AML case cannot move from ${from} to ${to}`, [
      { path: 'status', message: `Allowed from ${from}: ${CASE_TRANSITIONS[from].join(', ') || 'none'}` },
    ]);
  }
}
