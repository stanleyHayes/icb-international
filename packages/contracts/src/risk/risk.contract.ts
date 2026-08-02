import { z } from 'zod';

import {
  alertSeveritySchema,
  caseStatusSchema,
  disputeOutcomeSchema,
  disputeStageSchema,
  riskDecisionSchema,
} from '../common/enums.js';
import { cursorQuerySchema, offsetQuerySchema } from '../common/pagination.js';
import {
  assetRefSchema,
  idSchema,
  isoDateTimeSchema,
  moneySchema,
} from '../common/primitives.js';

/**
 * One rule that fired, and what it contributed.
 *
 * Scores without attribution are unauditable and unappealable. Every decision ICB makes about a
 * customer's money carries the reasoning that produced it.
 */
export const firedRuleSchema = z.object({
  code: z.string(),
  label: z.string(),
  weight: z.number(),
  contribution: z.number(),
  observed: z.string(),
  threshold: z.string().nullable(),
});

export const riskAssessmentSchema = z.object({
  id: idSchema,
  subjectType: z.enum(['transfer', 'card_authorisation', 'login', 'beneficiary', 'customer']),
  subjectId: idSchema,
  score: z.int().min(0).max(100),
  decision: riskDecisionSchema,
  firedRules: z.array(firedRuleSchema),
  /** Plain-language summary an analyst can paste into a case note. */
  narrative: z.string(),
  assessedAt: isoDateTimeSchema,
});

export const riskRuleSchema = z.object({
  id: idSchema,
  code: z.string(),
  label: z.string(),
  description: z.string(),
  kind: z.enum([
    'velocity',
    'amount_anomaly',
    'new_beneficiary',
    'geo_velocity',
    'device_change',
    'mcc_risk',
    'time_of_day',
    'dormant_reactivation',
    'structuring',
    'allow_list',
    'deny_list',
  ]),
  enabled: z.boolean(),
  weight: z.number().min(0).max(100),
  parameters: z.record(z.string().max(40), z.union([z.string(), z.number(), z.boolean()])),
  updatedBy: z.string().nullable(),
  updatedAt: isoDateTimeSchema,
});

export const updateRiskRuleRequestSchema = z.object({
  enabled: z.boolean().optional(),
  weight: z.number().min(0).max(100).optional(),
  parameters: z.record(z.string().max(40), z.union([z.string(), z.number(), z.boolean()])).optional(),
  reason: z.string().min(4).max(500),
});

export const riskCaseSchema = z.object({
  id: idSchema,
  reference: z.string(),
  customerId: idSchema,
  customerName: z.string(),
  severity: alertSeveritySchema,
  status: caseStatusSchema,
  assessment: riskAssessmentSchema,
  amountAtRisk: moneySchema.nullable(),
  assignedTo: z.string().nullable(),
  resolution: z
    .object({
      action: z.enum(['released', 'blocked', 'customer_contacted', 'escalated_to_aml', 'no_action']),
      note: z.string(),
      by: z.string(),
      at: isoDateTimeSchema,
    })
    .nullable(),
  createdAt: isoDateTimeSchema,
});

export const resolveRiskCaseRequestSchema = z.object({
  action: z.enum(['released', 'blocked', 'customer_contacted', 'escalated_to_aml', 'no_action']),
  note: z.string().min(4).max(2000),
});

export const riskCaseQuerySchema = offsetQuerySchema.extend({
  status: z.array(caseStatusSchema).optional(),
  severity: z.array(alertSeveritySchema).optional(),
  decision: z.array(riskDecisionSchema).optional(),
  assignedTo: idSchema.optional(),
});

// ---- AML ------------------------------------------------------------------

export const AML_ALERT_KINDS = [
  'sanctions_match',
  'pep_match',
  'adverse_media',
  'structuring',
  'rapid_movement',
  'round_amount_pattern',
  'high_risk_corridor',
  'threshold_aggregation',
] as const;

export const amlAlertSchema = z.object({
  id: idSchema,
  reference: z.string(),
  kind: z.enum(AML_ALERT_KINDS),
  customerId: idSchema,
  customerName: z.string(),
  severity: alertSeveritySchema,
  status: caseStatusSchema,
  matchDetail: z.string(),
  matchScore: z.number().min(0).max(1).nullable(),
  relatedTransactionIds: z.array(idSchema),
  aggregateAmount: moneySchema.nullable(),
  narrative: z.string().nullable(),
  assignedTo: z.string().nullable(),
  filedReport: z
    .object({
      kind: z.enum(['sar', 'ctr']),
      reference: z.string(),
      filedAt: isoDateTimeSchema,
      asset: assetRefSchema.nullable(),
    })
    .nullable(),
  createdAt: isoDateTimeSchema,
});

export const updateAmlAlertRequestSchema = z.object({
  status: caseStatusSchema.optional(),
  assignedTo: idSchema.nullable().optional(),
  narrative: z.string().max(8000).optional(),
});

export const fileReportRequestSchema = z.object({
  kind: z.enum(['sar', 'ctr']),
  narrative: z.string().min(50).max(8000),
});

export const amlAlertQuerySchema = offsetQuerySchema.extend({
  kind: z.array(z.enum(AML_ALERT_KINDS)).optional(),
  status: z.array(caseStatusSchema).optional(),
  severity: z.array(alertSeveritySchema).optional(),
});

// ---- Disputes -------------------------------------------------------------

export const DISPUTE_REASONS = [
  'unauthorised',
  'duplicate_charge',
  'incorrect_amount',
  'goods_not_received',
  'goods_not_as_described',
  'cancelled_recurring',
  'credit_not_processed',
  'atm_no_cash',
  'other',
] as const;

export const disputeReasonSchema = z.enum(DISPUTE_REASONS);

export const disputeSchema = z.object({
  id: idSchema,
  reference: z.string(),
  transactionId: idSchema,
  customerId: idSchema,
  customerName: z.string(),
  amount: moneySchema,
  reason: disputeReasonSchema,
  detail: z.string(),
  stage: disputeStageSchema,
  outcome: disputeOutcomeSchema.nullable(),
  evidence: z.array(
    z.object({
      id: idSchema,
      label: z.string(),
      asset: assetRefSchema,
      uploadedBy: z.enum(['customer', 'staff', 'merchant']),
      uploadedAt: isoDateTimeSchema,
    }),
  ),
  provisionalCredit: z
    .object({
      amount: moneySchema,
      transactionId: idSchema,
      grantedAt: isoDateTimeSchema,
      clawedBackAt: isoDateTimeSchema.nullable(),
    })
    .nullable(),
  timeline: z.array(
    z.object({ at: isoDateTimeSchema, stage: disputeStageSchema, note: z.string() }),
  ),
  slaDueAt: isoDateTimeSchema,
  resolvedAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export const createDisputeRequestSchema = z.object({
  transactionId: idSchema,
  reason: disputeReasonSchema,
  detail: z.string().min(10).max(2000),
  contactedMerchant: z.boolean(),
  evidence: z.array(z.object({ label: z.string().max(120), asset: assetRefSchema })).max(10),
});

export const advanceDisputeRequestSchema = z.object({
  stage: disputeStageSchema,
  note: z.string().min(4).max(2000),
  outcome: disputeOutcomeSchema.optional(),
  grantProvisionalCredit: z.boolean().optional(),
});

export const disputeQuerySchema = cursorQuerySchema.extend({
  stage: z.array(disputeStageSchema).optional(),
  reason: z.array(disputeReasonSchema).optional(),
  overdueOnly: z.coerce.boolean().optional(),
});

export type FiredRule = z.infer<typeof firedRuleSchema>;
export type RiskAssessment = z.infer<typeof riskAssessmentSchema>;
export type RiskRule = z.infer<typeof riskRuleSchema>;
export type RiskCase = z.infer<typeof riskCaseSchema>;
export type AmlAlert = z.infer<typeof amlAlertSchema>;
export type Dispute = z.infer<typeof disputeSchema>;
export type CreateDisputeRequest = z.infer<typeof createDisputeRequestSchema>;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];
export type AmlAlertKind = (typeof AML_ALERT_KINDS)[number];
