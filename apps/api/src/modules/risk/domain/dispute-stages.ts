import type { DisputeOutcome, DisputeStage } from '@icb/contracts';

/**
 * The dispute lifecycle.
 *
 * The happy path is linear — submitted, investigating, provisional credit, representment,
 * arbitration, resolved — but every non-terminal stage may also jump straight to resolved,
 * because most disputes end early: the merchant refunds, the customer recognises the charge, or
 * the evidence is conclusive. Modelling that as an exception rather than a legal move would push
 * analysts into resolving cases by editing the database.
 */
export const INITIAL_STAGE: DisputeStage = 'submitted';
export const TERMINAL_STAGE: DisputeStage = 'resolved';

const NEXT_STAGES: Readonly<Record<DisputeStage, readonly DisputeStage[]>> = {
  submitted: ['investigating', TERMINAL_STAGE],
  investigating: ['provisional_credit', 'representment', TERMINAL_STAGE],
  provisional_credit: ['representment', TERMINAL_STAGE],
  representment: ['arbitration', TERMINAL_STAGE],
  arbitration: [TERMINAL_STAGE],
  resolved: [],
};

export function allowedNextStages(from: DisputeStage): readonly DisputeStage[] {
  return NEXT_STAGES[from];
}

export function canAdvance(from: DisputeStage, to: DisputeStage): boolean {
  return NEXT_STAGES[from].includes(to);
}

export function isTerminal(stage: DisputeStage): boolean {
  return stage === TERMINAL_STAGE;
}

/**
 * Outcomes that leave the money with the customer.
 *
 * `partial` counts as the customer's favour: whatever provisional credit was granted stands, and
 * any further adjustment is a separate, deliberate posting rather than a silent clawback.
 */
const CUSTOMER_FAVOUR: readonly DisputeOutcome[] = ['upheld', 'partial'];

export function isInCustomerFavour(outcome: DisputeOutcome): boolean {
  return CUSTOMER_FAVOUR.includes(outcome);
}

/** Only a full upholding creates credit that was never granted; `partial` merely keeps it. */
export function grantsCreditOnResolution(outcome: DisputeOutcome): boolean {
  return outcome === 'upheld';
}
