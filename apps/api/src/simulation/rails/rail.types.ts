import type { RailProfile, SimulationRail } from '@icb/contracts';
import type { Money } from '@icb/money';

import type { RandomHelpers } from '../seed/random.js';

/**
 * The rail port.
 *
 * A "rail" is the outside world: ACH, a wire network, SWIFT, a card scheme. ICB never talks to
 * any of them, so this is the single seam where the outside world is pretended into existence.
 * Everything a rail does — accept, reject, take time, settle later — is expressed here, which is
 * what stops each product module inventing its own idea of what "sent" means.
 */

/** What ICB hands to a rail. Deliberately rail-agnostic: the adapter shapes the wire format. */
export interface RailSubmission {
  /** The transfer, card authorisation, or bill payment this submission belongs to. */
  readonly sourceId: string;
  readonly amount: Money;
  /** Sending account number, as it would appear on the instruction. */
  readonly debtorAccount: string;
  readonly debtorName: string;
  readonly creditorName: string;
  /** IBAN, account number, or PAN token — whatever addresses the far side on this rail. */
  readonly creditorAccount: string;
  readonly narrative: string;
  /** Correspondent BICs for SWIFT, merchant category for cards, and so on. */
  readonly attributes?: Readonly<Record<string, string>>;
}

/** Everything an adapter is allowed to depend on. No adapter reads the clock or Math.random. */
export interface RailContext {
  readonly profile: RailProfile;
  readonly random: RandomHelpers;
  readonly submittedAt: Date;
  /** Settlement date resolved against the business calendar, honouring the rail's cut-off. */
  readonly settlesAt: Date;
  /** True when `submittedAt` is at or past the profile's cut-off time. */
  readonly pastCutOff: boolean;
}

export interface RailAccepted {
  readonly accepted: true;
  readonly rail: SimulationRail;
  /** The reference the far side would quote back: a trace number, IMAD, or auth code. */
  readonly railReference: string;
  readonly settlesAt: Date;
  readonly latencyMs: number;
  /** The instruction as the rail would carry it — MT103 blocks, NACHA fields, ISO-8583 DEs. */
  readonly payload: Readonly<Record<string, string>>;
}

export interface RailRejected {
  readonly accepted: false;
  readonly rail: SimulationRail;
  /** The rail's own code: `R01`, `51`, `RAIL_UNAVAILABLE`. Never an ICB error code. */
  readonly code: string;
  readonly label: string;
  readonly latencyMs: number;
  readonly payload: Readonly<Record<string, string>>;
}

export type RailResult = RailAccepted | RailRejected;

/**
 * One simulated network.
 *
 * `submit` is synchronous and pure given its context: the same profile, the same random stream
 * and the same instant always produce the same result. Latency is *reported*, not slept through,
 * so a scenario generating ten thousand events is not gated on wall time; the registry applies
 * the delay when a caller actually wants it.
 */
export interface Rail {
  readonly rail: SimulationRail;
  /**
   * Other rail keys this adapter answers for. `on_us` is the same book transfer as `internal`
   * under a name the transfers contract uses, and giving it its own adapter would duplicate the
   * behaviour rather than describe it.
   */
  readonly aliases?: readonly SimulationRail[];
  /** Shipped defaults, used to populate `sim_state` the first time the bank boots. */
  readonly defaultProfile: RailProfile;
  submit(submission: RailSubmission, context: RailContext): RailResult;
}

export interface DispatchOptions {
  /** Sleep for the sampled latency. Off for batch work, on for a single operator action. */
  readonly applyLatency?: boolean;
}
