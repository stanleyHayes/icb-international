import type { RiskRule } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';

/**
 * The shape every fraud rule takes.
 *
 * A rule is a *pure function* of a context and its own parameters. It reads nothing, writes
 * nothing, and reaches for no clock — which is what makes the whole engine unit-testable and what
 * lets an analyst reproduce a decision months later from the stored context alone.
 *
 * The outcome is deliberately verbose: `observed` and `threshold` are the sentences that end up
 * in the case note, so they are produced by the rule that actually knows what it measured rather
 * than reconstructed later by something that is guessing.
 */

export type RuleParameters = RiskRule['parameters'];
export type RiskRuleKind = RiskRule['kind'];

/** One prior movement on the customer's own accounts — the baseline a rule compares against. */
export interface HistoryPoint {
  readonly minorUnits: number;
  readonly at: Date;
}

/**
 * Everything a rule is allowed to see.
 *
 * Assembled once per assessment so that ten rules do not issue ten sets of queries, and so that
 * the exact inputs behind a decision can be replayed.
 */
export interface RuleContext {
  readonly customerId: string;
  readonly amountMinorUnits: number;
  readonly currency: CurrencyCode;
  /** Clock-derived instant of the event being assessed. Never wall time. */
  readonly at: Date;
  readonly history: readonly HistoryPoint[];
  readonly beneficiaryId: string | null;
  readonly knownBeneficiaryIds: readonly string[];
  readonly countryCode: string | null;
  readonly lastCountryCode: string | null;
  readonly lastCountryAt: Date | null;
  readonly deviceId: string | null;
  readonly knownDeviceIds: readonly string[];
  readonly mcc: string | null;
  readonly lastActivityAt: Date | null;
}

export interface RuleOutcome {
  readonly fired: boolean;
  /** What the rule actually measured, in plain language. Always populated, fired or not. */
  readonly observed: string;
  /** What it was measured against, or null when the rule had nothing to compare with. */
  readonly threshold: string | null;
  /** 0..1 — the fraction of the rule's configured weight this observation earns. */
  readonly contribution: number;
}

export type RuleEvaluator = (context: RuleContext, parameters: RuleParameters) => RuleOutcome;

/** A rule that looked and found nothing. It still reports what it looked at. */
export function notFired(observed: string, threshold: string | null = null): RuleOutcome {
  return { fired: false, observed, threshold, contribution: 0 };
}

export function fired(observed: string, threshold: string, contribution: number): RuleOutcome {
  return { fired: true, observed, threshold, contribution };
}
