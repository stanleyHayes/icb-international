/**
 * Every tunable the AML programme runs on, in one place.
 *
 * Thresholds are integer minor units of a scale-2 currency (N3) — 1_000_000 is 10,000.00, the
 * classic currency-transaction-report line. These are programme parameters, not secrets: an
 * analyst tuning one should never have to read detector code to find it.
 */

/** Currency transaction report: same-business-day cash-in at or above this is reportable. */
export const CTR_THRESHOLD_MINOR_UNITS = 1_000_000;

/**
 * Structuring: several deposits each kept just under the report threshold but summing above it.
 * The lower bound filters out ordinary life — three pay-cheques are not a pattern.
 */
export const STRUCTURING_LOWER_RATIO = 0.7;
export const STRUCTURING_MIN_COUNT = 3;
export const STRUCTURING_WINDOW_DAYS = 7;

/** Rapid in-out: funds arrive and leave again before they could plausibly be earned or spent. */
export const RAPID_MOVEMENT_WINDOW_HOURS = 48;
export const RAPID_MOVEMENT_OUT_RATIO = 0.8;
export const RAPID_MOVEMENT_MIN_MINOR_UNITS = 500_000;

/** Round amounts: repeated transfers of exact multiples of 1,000.00 read as placement. */
export const ROUND_AMOUNT_STEP_MINOR_UNITS = 100_000;
export const ROUND_AMOUNT_MIN_COUNT = 4;
export const ROUND_AMOUNT_WINDOW_DAYS = 14;

/**
 * Corridors the simulated programme treats as high risk. Deliberately the same fiction-friendly
 * posture as the watchlist: this is a training dataset, not a regulatory opinion.
 */
export const HIGH_RISK_COUNTRIES: readonly string[] = ['KP', 'IR', 'SY', 'CU', 'MM', 'BY'];

/** How far back a monitoring scan reads. The EOD batch re-scans daily, so windows roll. */
export const MONITORING_LOOKBACK_DAYS = 30;
export const MONITORING_HISTORY_LIMIT = 500;

/** Only completed postings count as behaviour; pending and declined noise does not. */
export const SETTLED_TRANSACTION_STATUSES: readonly string[] = ['posted', 'settled'];

/** Ledger transaction types that are cash-equivalent inbound value for CTR aggregation. */
export const CTR_CASH_IN_TYPES: readonly string[] = ['deposit'];

/** An aggregate this many times the CTR threshold escalates the alert one severity band. */
export const SEVERITY_ESCALATION_MULTIPLE = 3;

/** Similarity floor for the local adverse-media list (same 0–1 scale as the kyc watchlist). */
export const ADVERSE_MEDIA_MATCH_FLOOR = 0.7;

/** One fabricated adverse-media subject. Fiction, like the watchlist — never a real person. */
export interface AdverseMediaEntry {
  readonly name: string;
  readonly topic: string;
  readonly source: string;
}

/** Tag on every simulated press subject, so nobody mistakes the list for real coverage. */
const SIMULATED_PRESS = 'ICB-SIM-PRESS';

/**
 * The local adverse-media list. ICB never calls an external news bureau (N2), so negative-news
 * screening runs against this fixed set of invented subjects, all tagged `ICB-SIM-PRESS`.
 */
export const ADVERSE_MEDIA: readonly AdverseMediaEntry[] = [
  { name: 'Casper Wilhelm Brondum', topic: 'embezzlement conviction coverage', source: SIMULATED_PRESS },
  { name: 'Renata Lucille Fontaine', topic: 'Ponzi scheme investigation', source: SIMULATED_PRESS },
  { name: 'Tariq Bashir El-Amin', topic: 'sanctions evasion reporting', source: SIMULATED_PRESS },
  { name: 'Svetlana Igorovna Marshankova', topic: 'procurement fraud indictment', source: SIMULATED_PRESS },
  { name: 'Diego Armando Castellanos-Ruiz', topic: 'narcotics trafficking charges', source: SIMULATED_PRESS },
];

export const MS_PER_DAY = 86_400_000;
export const MS_PER_HOUR = 3_600_000;
