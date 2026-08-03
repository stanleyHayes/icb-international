import type { TransferRail } from '@icb/contracts';

import type { RailSubmission } from '../../../simulation/rails/rail.types.js';

/** Injection token — the use-cases' only view of the outside world. */
export const RAIL_DISPATCH_PORT = Symbol('ICB_RAIL_DISPATCH_PORT');

export interface RailDispatchOutcome {
  readonly railReference: string;
  readonly settlesAt: Date;
}

export interface RailEstimate {
  readonly settlesAt: Date;
  readonly cutOffAt: Date | null;
  readonly pastCutOff: boolean;
}

/**
 * The settlement-scheduling seam.
 *
 * Rail behaviour — acceptance, rejection, cut-offs, settlement dates — lives in
 * `simulation/rails`, the only place a rail may exist (N2). This port is the narrow surface the
 * transfer use-cases consume, and the boundary tests mock: no rail logic in the transfers
 * module, no transfer logic in the rails.
 */
export interface RailDispatchPort {
  /** Hand an instruction to the rail. Throws RailRejectedError when the rail refuses it. */
  dispatch(rail: TransferRail, submission: RailSubmission): Promise<RailDispatchOutcome>;
  /** When a submission made at `at` would settle, given the rail's live profile. */
  estimate(rail: TransferRail, at: Date): Promise<RailEstimate>;
}
