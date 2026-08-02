import { KYC_CHECK_KINDS, type KycCheck, type KycDocumentType, type RiskRating } from '@icb/contracts';

import {
  detailFor,
  screeningDetail,
  type CheckKind,
  type CheckVerdict,
} from './check-details.js';
import { stableUnit, toScore } from './stable-hash.js';
import { screenName, STRONG_MATCH, WEAK_MATCH, type WatchlistKind } from './watchlist.js';

/**
 * The simulated verification bureau.
 *
 * Two rules govern everything here:
 *
 *  1. **Deterministic.** An outcome is a pure function of the customer id and the check kind, so
 *     the same customer screens identically on every machine, after every reseed, forever. A demo
 *     that randomises would show a different story each time it is run and could not be scripted.
 *  2. **No network.** Sanctions and PEP screening consult the local list in `watchlist.ts`. There
 *     is no external bureau to be unavailable, rate-limited or billed.
 *
 * The score is read as *confidence that this check is clean* — high is good for every kind,
 * including screening, where a strong watchlist match produces a low score.
 */

export interface CheckSubject {
  readonly customerId: string;
  readonly customerName: string;
  readonly customerType: 'individual' | 'business';
  readonly documentTypes: readonly KycDocumentType[];
  /** ISO instant supplied by ClockService — this module never reads a clock itself. */
  readonly completedAt: string;
}

interface CheckResult {
  readonly verdict: CheckVerdict;
  readonly score: number | null;
  readonly detail: string;
}

/**
 * Where the hash has to land for a check to go badly.
 *
 * These are calibrated against the *case*, not the check: seven checks each failing 5% of the
 * time would send two thirds of applicants to manual review. As set, roughly three quarters of
 * customers clear every check automatically and the rest populate the queue — which is both a
 * believable auto-approval rate for a retail bank and a demo where the review screen has work
 * in it.
 */
const BANDS: Readonly<Record<CheckKind, { fail: number; refer: number }>> = {
  document_authenticity: { fail: 0.015, refer: 0.055 },
  face_match: { fail: 0.012, refer: 0.05 },
  liveness: { fail: 0.01, refer: 0.045 },
  address_verification: { fail: 0.02, refer: 0.07 },
  sanctions_screening: { fail: 0.004, refer: 0.02 },
  pep_screening: { fail: 0.006, refer: 0.025 },
  adverse_media: { fail: 0.008, refer: 0.04 },
  business_registry: { fail: 0.015, refer: 0.06 },
};

/** The document types that make a check answerable. Absent evidence is referred, never failed. */
const EVIDENCE: Partial<Record<CheckKind, readonly KycDocumentType[]>> = {
  document_authenticity: ['national_id', 'passport', 'drivers_licence'],
  face_match: ['selfie'],
  liveness: ['selfie'],
  address_verification: ['proof_of_address'],
  business_registry: ['business_registration'],
};

const BUSINESS_ONLY: readonly CheckKind[] = ['business_registry'];

const DISCOUNTED_MATCH = 'A weak name overlap with a listed name was reviewed and discounted.';

/** Presentation bands for the score, so a pass reads as a pass rather than as a bare number. */
const FAIL_SCORE = { low: 0, high: 0.3 } as const;
const REFER_SCORE = { low: 0.45, high: 0.75 } as const;
const PASS_SCORE = { low: 0.85, high: 0.999 } as const;

/** Run every applicable check for one subject. */
export function runChecks(subject: CheckSubject): KycCheck[] {
  return applicableKinds(subject.customerType).map((kind) => evaluate(kind, subject));
}

/**
 * The case-level risk rating implied by its checks: one failure makes a case high risk, one
 * referral makes it medium. Staff may override this when they decide.
 */
export function deriveRiskRating(checks: readonly KycCheck[]): RiskRating {
  if (checks.some((check) => check.outcome === 'fail')) {
    return 'high';
  }
  if (checks.some((check) => check.outcome === 'refer')) {
    return 'medium';
  }
  return 'low';
}

/** Business customers additionally face the registry check; individuals have no registry entry. */
function applicableKinds(customerType: CheckSubject['customerType']): readonly CheckKind[] {
  if (customerType === 'business') {
    return KYC_CHECK_KINDS;
  }
  return KYC_CHECK_KINDS.filter((kind) => !BUSINESS_ONLY.includes(kind));
}

function evaluate(kind: CheckKind, subject: CheckSubject): KycCheck {
  const result = resolve(kind, subject);
  return {
    kind,
    outcome: result.verdict,
    score: result.score,
    detail: result.detail,
    completedAt: subject.completedAt,
  };
}

function resolve(kind: CheckKind, subject: CheckSubject): CheckResult {
  if (kind === 'sanctions_screening') {
    return screen(kind, subject, 'sanctions');
  }
  if (kind === 'pep_screening') {
    return screen(kind, subject, 'pep');
  }
  if (lacksEvidence(kind, subject.documentTypes)) {
    return { verdict: 'refer', score: null, detail: detailFor(kind, 'missing') };
  }
  const banded = bandFor(kind, subject.customerId);
  return { ...banded, detail: detailFor(kind, banded.verdict) };
}

/**
 * Screening: the local list decides first, and only a clean name falls through to the residual
 * band — which is how a real bureau behaves, where most alerts come from the list and a small
 * tail comes from data quality.
 */
function screen(kind: CheckKind, subject: CheckSubject, list: WatchlistKind): CheckResult {
  const hit = screenName(subject.customerName, list);

  if (hit === null) {
    const banded = bandFor(kind, subject.customerId);
    return { ...banded, detail: detailFor(kind, banded.verdict) };
  }

  const verdict = verdictForHit(hit.similarity);
  const base = verdict === 'pass' ? DISCOUNTED_MATCH : detailFor(kind, verdict);

  return {
    verdict,
    score: toScore(1 - hit.similarity),
    detail: screeningDetail(base, hit.entry.programme, hit.similarity),
  };
}

function verdictForHit(similarity: number): CheckVerdict {
  if (similarity >= STRONG_MATCH) {
    return 'fail';
  }
  return similarity >= WEAK_MATCH ? 'refer' : 'pass';
}

function lacksEvidence(kind: CheckKind, provided: readonly KycDocumentType[]): boolean {
  const accepted = EVIDENCE[kind];
  if (accepted === undefined) {
    return false;
  }
  return !accepted.some((type) => provided.includes(type));
}

/** Project the stable hash onto a verdict band, then onto a presentable score. */
function bandFor(
  kind: CheckKind,
  customerId: string,
): { verdict: CheckVerdict; score: number } {
  const unit = stableUnit(customerId, kind);
  const band = BANDS[kind];

  if (unit < band.fail) {
    return { verdict: 'fail', score: rescale(unit, 0, band.fail, FAIL_SCORE) };
  }
  if (unit < band.refer) {
    return { verdict: 'refer', score: rescale(unit, band.fail, band.refer, REFER_SCORE) };
  }
  return { verdict: 'pass', score: rescale(unit, band.refer, 1, PASS_SCORE) };
}

function rescale(
  value: number,
  fromLow: number,
  fromHigh: number,
  target: { readonly low: number; readonly high: number },
): number {
  const span = fromHigh - fromLow;
  const ratio = span <= 0 ? 0 : (value - fromLow) / span;
  return toScore(target.low + ratio * (target.high - target.low));
}
