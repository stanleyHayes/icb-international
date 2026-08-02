import type { KycCase, KycCheck, KycDocument } from '@icb/contracts';

import type { FactoryContext } from '../core/context.js';
import { buildAssetRef } from './helpers.js';

const SLA_DAYS = 2;
const DOCUMENT_REVIEW_HOURS_MS = 3_600_000;

export interface KycCaseOptions extends Partial<KycCase> {
  readonly customerId?: string;
  readonly customerName?: string;
}

/**
 * KYC case factory.
 *
 * Default: a tier-2 case awaiting review — one uploaded national ID, document checks passed,
 * screenings pending. The state an ops-queue test most often needs.
 */
export function kycCase(ctx: FactoryContext, options: KycCaseOptions = {}): KycCase {
  const {
    customerId = ctx.nextId(),
    customerName = ctx.faker.person.fullName(),
    ...overrides
  } = options;
  const base: KycCase = {
    id: ctx.nextId(),
    customerId,
    customerName,
    requestedLevel: 'tier_2',
    status: 'pending_review',
    documents: [kycDocument(ctx)],
    checks: kycChecks(ctx),
    riskRating: 'low',
    decision: null,
    slaDueAt: ctx.clock.isoPlusDays(SLA_DAYS),
    createdAt: ctx.clock.iso(),
    updatedAt: ctx.clock.iso(),
  };
  return { ...base, ...overrides };
}

export function kycDocument(
  ctx: FactoryContext,
  overrides: Partial<KycDocument> = {},
): KycDocument {
  const base: KycDocument = {
    id: ctx.nextId(),
    type: 'national_id',
    asset: buildAssetRef(ctx),
    status: 'accepted',
    rejectionReason: null,
    documentNumber: `GHA-${ctx.digits(9)}`,
    issuingCountry: 'GH',
    expiresOn: ctx.clock.datePlusDays(365 * 10),
    uploadedAt: ctx.clock.iso(),
    reviewedAt: new Date(ctx.clock.epochMilliseconds() + DOCUMENT_REVIEW_HOURS_MS).toISOString(),
  };
  return { ...base, ...overrides };
}

export function kycChecks(ctx: FactoryContext): KycCheck[] {
  const completedAt = ctx.clock.iso();
  return [
    { kind: 'document_authenticity', outcome: 'pass', score: 0.98, detail: null, completedAt },
    { kind: 'face_match', outcome: 'pass', score: 0.95, detail: null, completedAt },
    { kind: 'liveness', outcome: 'pass', score: 0.99, detail: null, completedAt },
    {
      kind: 'sanctions_screening',
      outcome: 'pending',
      score: null,
      detail: null,
      completedAt: null,
    },
    { kind: 'pep_screening', outcome: 'pending', score: null, detail: null, completedAt: null },
  ];
}
