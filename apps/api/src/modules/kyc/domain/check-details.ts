import type { KycCheck } from '@icb/contracts';

/**
 * What a compliance officer actually reads.
 *
 * The detail line is the whole value of an automated check to a human reviewer: "fail" tells
 * them nothing, "MRZ checksum did not validate" tells them what to look at. Keeping the wording
 * as data means the queue never renders an empty reason, and the phrasing can be reviewed by
 * compliance without touching the decision logic.
 */

export type CheckKind = KycCheck['kind'];
export type CheckVerdict = 'pass' | 'fail' | 'refer';
export type DetailKey = CheckVerdict | 'missing';

interface DetailSet {
  readonly pass: string;
  readonly fail: string;
  readonly refer: string;
  readonly missing?: string;
}

const DETAILS: Readonly<Record<CheckKind, DetailSet>> = {
  document_authenticity: {
    pass: 'Security features, MRZ checksum and font profile are consistent with a genuine document.',
    fail: 'MRZ checksum did not validate and the portrait layer shows signs of substitution.',
    refer: 'Image quality is too low to confirm the security features; a manual look is needed.',
    missing: 'No photographic identity document has been attached to this case.',
  },
  face_match: {
    pass: 'Selfie and document portrait match on all measured landmarks.',
    fail: 'Selfie and document portrait differ beyond the acceptance threshold.',
    refer: 'Partial occlusion in the selfie left the comparison inconclusive.',
    missing: 'No selfie has been attached, so there is nothing to compare the portrait against.',
  },
  liveness: {
    pass: 'Depth, texture and micro-movement signals are consistent with a live capture.',
    fail: 'Capture shows screen-replay artefacts consistent with a presentation attack.',
    refer: 'Lighting reduced confidence in the liveness signals below the automatic threshold.',
    missing: 'No selfie capture is present, so liveness could not be assessed.',
  },
  address_verification: {
    pass: 'Declared residential address matches the attached proof and is dated within 90 days.',
    fail: 'Declared address does not appear on the attached proof of address.',
    refer: 'Proof of address is older than 90 days; a more recent document may be required.',
    missing: 'No proof of address has been attached to this case.',
  },
  sanctions_screening: {
    pass: 'No match against the maintained sanctions list.',
    fail: 'Strong name match against a listed sanctions target.',
    refer: 'Partial name match against a listed sanctions target; identity must be disambiguated.',
  },
  pep_screening: {
    pass: 'No match against the maintained politically exposed persons list.',
    fail: 'Strong name match against a listed politically exposed person.',
    refer: 'Partial match against a politically exposed person; enhanced due diligence advised.',
  },
  adverse_media: {
    pass: 'No adverse media found in the monitored corpus.',
    fail: 'Adverse media links this name to an ongoing financial-crime investigation.',
    refer: 'Adverse media of uncertain relevance found; a reviewer should assess the articles.',
  },
  business_registry: {
    pass: 'Company number, legal name and directors reconcile with the registry extract.',
    fail: 'Company number does not resolve to an active entity in the registry.',
    refer: 'Registry record differs from the declared details and needs reconciliation.',
    missing: 'No business registration document has been attached to this case.',
  },
};

const MISSING_FALLBACK = 'The evidence this check requires has not been supplied.';

/** The reviewer-facing sentence for one check outcome. */
export function detailFor(kind: CheckKind, key: DetailKey): string {
  const set = DETAILS[kind];
  return key === 'missing' ? (set.missing ?? MISSING_FALLBACK) : set[key];
}

/** A screening detail that names what was hit, rather than the generic sentence. */
export function screeningDetail(base: string, programme: string, similarity: number): string {
  const confidence = Math.round(similarity * 100);
  return `${base} Programme ${programme}, name confidence ${confidence}%.`;
}
