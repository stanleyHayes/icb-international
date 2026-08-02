import { z } from 'zod';

import {
  kycDocumentTypeSchema,
  kycLevelSchema,
  kycStatusSchema,
  riskRatingSchema,
} from '../common/enums.js';
import { offsetQuerySchema } from '../common/pagination.js';
import {
  assetRefSchema,
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  moneySchema,
} from '../common/primitives.js';

/**
 * KYC tiers.
 *
 * Tier gates what a customer may do, not merely what a compliance report says. Limits are
 * enforced by the transfer pipeline, so an under-verified customer physically cannot exceed
 * their ceiling.
 */
export const kycTierLimitsSchema = z.object({
  level: kycLevelSchema,
  singleTransfer: moneySchema,
  dailyTransfer: moneySchema,
  monthlyTransfer: moneySchema,
  maxBalance: moneySchema.nullable(),
  internationalAllowed: z.boolean(),
});

export const kycDocumentSchema = z.object({
  id: idSchema,
  type: kycDocumentTypeSchema,
  asset: assetRefSchema,
  status: z.enum(['uploaded', 'processing', 'accepted', 'rejected']),
  rejectionReason: z.string().nullable(),
  documentNumber: z.string().nullable(),
  issuingCountry: z.string().length(2).nullable(),
  expiresOn: isoDateSchema.nullable(),
  uploadedAt: isoDateTimeSchema,
  reviewedAt: isoDateTimeSchema.nullable(),
});

export const KYC_CHECK_KINDS = [
  'document_authenticity',
  'face_match',
  'liveness',
  'address_verification',
  'sanctions_screening',
  'pep_screening',
  'adverse_media',
  'business_registry',
] as const;

export const kycCheckSchema = z.object({
  kind: z.enum(KYC_CHECK_KINDS),
  outcome: z.enum(['pass', 'fail', 'refer', 'pending']),
  score: z.number().min(0).max(1).nullable(),
  detail: z.string().nullable(),
  completedAt: isoDateTimeSchema.nullable(),
});

export const kycCaseSchema = z.object({
  id: idSchema,
  customerId: idSchema,
  customerName: z.string(),
  requestedLevel: kycLevelSchema,
  status: kycStatusSchema,
  documents: z.array(kycDocumentSchema),
  checks: z.array(kycCheckSchema),
  riskRating: riskRatingSchema.nullable(),
  decision: z
    .object({
      outcome: z.enum(['approved', 'rejected', 'more_info_required']),
      grantedLevel: kycLevelSchema.nullable(),
      reason: z.string(),
      decidedBy: z.string(),
      decidedAt: isoDateTimeSchema,
    })
    .nullable(),
  /** Deadline the ops team is measured against. Drives queue ordering in the admin console. */
  slaDueAt: isoDateTimeSchema,
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
});

/** Signature payload for a direct browser → Cloudinary upload. Bytes never touch the API. */
export const uploadSignatureRequestSchema = z.object({
  documentType: kycDocumentTypeSchema,
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  sizeBytes: z.int().positive().max(15 * 1024 * 1024),
});

export const uploadSignatureSchema = z.object({
  uploadUrl: z.url(),
  publicId: z.string(),
  folder: z.string(),
  timestamp: z.int(),
  signature: z.string(),
  apiKey: z.string(),
  expiresAt: isoDateTimeSchema,
});

export const attachDocumentRequestSchema = z.object({
  type: kycDocumentTypeSchema,
  asset: assetRefSchema,
  documentNumber: z.string().max(60).optional(),
  issuingCountry: z.string().length(2).optional(),
  expiresOn: isoDateSchema.optional(),
});

export const submitKycRequestSchema = z.object({
  requestedLevel: kycLevelSchema,
  declarationAccepted: z.literal(true),
});

export const kycDecisionRequestSchema = z.object({
  outcome: z.enum(['approved', 'rejected', 'more_info_required']),
  grantedLevel: kycLevelSchema.optional(),
  reason: z.string().min(4).max(1000),
  riskRating: riskRatingSchema.optional(),
});

export const kycQueueQuerySchema = offsetQuerySchema.extend({
  status: z.array(kycStatusSchema).optional(),
  level: kycLevelSchema.optional(),
  riskRating: riskRatingSchema.optional(),
  overdueOnly: z.coerce.boolean().optional(),
  assignedTo: idSchema.optional(),
});

export type KycTierLimits = z.infer<typeof kycTierLimitsSchema>;
export type KycDocument = z.infer<typeof kycDocumentSchema>;
export type KycCheck = z.infer<typeof kycCheckSchema>;
export type KycCase = z.infer<typeof kycCaseSchema>;
export type UploadSignature = z.infer<typeof uploadSignatureSchema>;
export type UploadSignatureRequest = z.infer<typeof uploadSignatureRequestSchema>;
export type SubmitKycRequest = z.infer<typeof submitKycRequestSchema>;
export type KycDecisionRequest = z.infer<typeof kycDecisionRequestSchema>;
export type KycQueueQuery = z.infer<typeof kycQueueQuerySchema>;
