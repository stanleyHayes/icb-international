/** A staff member who could take a ticket, with their current open workload. */
export interface AssignmentCandidate {
  readonly staffId: string;
  readonly openTickets: number;
}

/**
 * Least-loaded assignment.
 *
 * The agent with the fewest open tickets wins; ties break on the staff id so the same queue
 * always assigns the same way — an operator re-running auto-assign must not see tickets hop
 * between equally loaded agents. Returns null when nobody is available, leaving the ticket in
 * the unassigned pool rather than guessing.
 */
export function pickAssignee(candidates: readonly AssignmentCandidate[]): string | null {
  let best: AssignmentCandidate | null = null;
  for (const candidate of candidates) {
    if (best === null || isBetter(candidate, best)) {
      best = candidate;
    }
  }
  return best?.staffId ?? null;
}

function isBetter(left: AssignmentCandidate, right: AssignmentCandidate): boolean {
  if (left.openTickets !== right.openTickets) {
    return left.openTickets < right.openTickets;
  }
  return left.staffId < right.staffId;
}
