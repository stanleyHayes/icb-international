import { z } from 'zod';

import { cursorQuerySchema } from '../common/pagination.js';
import { idSchema, isoDateTimeSchema } from '../common/primitives.js';
import { transferDestinationSchema } from '../transfers/transfers.contract.js';

/**
 * A saved payee.
 *
 * New beneficiaries enter a cooling-off window during which transfers to them are capped. This
 * is the single most effective control against authorised-push-payment fraud, where an attacker
 * with session access adds their own account and drains the balance in one move.
 */
export const BENEFICIARY_COOLING_OFF_HOURS = 4;

export const beneficiarySchema = z.object({
  id: idSchema,
  nickname: z.string().max(60).nullable(),
  name: z.string().min(1).max(140),
  destination: transferDestinationSchema,
  /** Masked identifier suitable for display, e.g. `•••• 4821`. */
  displayIdentifier: z.string(),
  bankName: z.string().nullable(),
  currency: z.string().length(3).nullable(),
  verified: z.boolean(),
  favourite: z.boolean(),
  coolingOffUntil: isoDateTimeSchema.nullable(),
  lastUsedAt: isoDateTimeSchema.nullable(),
  useCount: z.int().nonnegative(),
  createdAt: isoDateTimeSchema,
});

export const createBeneficiaryRequestSchema = z.object({
  nickname: z.string().max(60).optional(),
  name: z.string().min(1).max(140),
  destination: transferDestinationSchema,
  favourite: z.boolean().default(false),
});

export const updateBeneficiaryRequestSchema = z.object({
  nickname: z.string().max(60).nullable().optional(),
  favourite: z.boolean().optional(),
});

export const beneficiaryQuerySchema = cursorQuerySchema.extend({
  q: z.string().max(120).optional(),
  favouritesOnly: z.coerce.boolean().optional(),
  verifiedOnly: z.coerce.boolean().optional(),
});

/**
 * Micro-deposit verification: ICB sends two small credits and the customer confirms the amounts.
 * Simulated end to end, but the flow — and its failure modes — are the real ones.
 */
export const verifyBeneficiaryRequestSchema = z.object({
  firstAmountMinorUnits: z.int().positive().max(99),
  secondAmountMinorUnits: z.int().positive().max(99),
});

export const beneficiaryVerificationSchema = z.object({
  beneficiaryId: idSchema,
  state: z.enum(['not_started', 'deposits_sent', 'verified', 'failed', 'locked']),
  attemptsRemaining: z.int().nonnegative(),
  depositsSentAt: isoDateTimeSchema.nullable(),
  verifiedAt: isoDateTimeSchema.nullable(),
});

export type Beneficiary = z.infer<typeof beneficiarySchema>;
export type CreateBeneficiaryRequest = z.infer<typeof createBeneficiaryRequestSchema>;
export type UpdateBeneficiaryRequest = z.infer<typeof updateBeneficiaryRequestSchema>;
export type BeneficiaryQuery = z.infer<typeof beneficiaryQuerySchema>;
export type BeneficiaryVerification = z.infer<typeof beneficiaryVerificationSchema>;
