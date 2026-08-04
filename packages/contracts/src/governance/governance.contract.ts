import { z } from 'zod';

import { staffRoleSchema } from '../common/enums.js';
import { offsetQuerySchema } from '../common/pagination.js';
import { emailSchema, idSchema, isoDateTimeSchema, moneySchema } from '../common/primitives.js';

// ---- Staff & audit --------------------------------------------------------

export const staffUserSchema = z.object({
  id: idSchema,
  email: emailSchema,
  firstName: z.string(),
  lastName: z.string(),
  roles: z.array(staffRoleSchema),
  active: z.boolean(),
  mfaEnabled: z.boolean(),
  lastLoginAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export const createStaffUserRequestSchema = z.object({
  email: emailSchema,
  firstName: z.string().min(1).max(60),
  lastName: z.string().min(1).max(60),
  roles: z.array(staffRoleSchema).min(1),
});

export const auditEventSchema = z.object({
  id: idSchema,
  sequence: z.int().nonnegative(),
  actorType: z.enum(['customer', 'staff', 'system']),
  actorId: idSchema.nullable(),
  actorLabel: z.string(),
  action: z.string(),
  subjectType: z.string(),
  subjectId: z.string().nullable(),
  summary: z.string(),
  changes: z.array(z.object({ field: z.string(), before: z.string(), after: z.string() })),
  ipAddress: z.string().nullable(),
  correlationId: z.string(),
  hash: z.string(),
  previousHash: z.string().nullable(),
  at: isoDateTimeSchema,
});

export const auditQuerySchema = offsetQuerySchema.extend({
  actorId: idSchema.optional(),
  action: z.string().max(80).optional(),
  subjectType: z.string().max(60).optional(),
  subjectId: z.string().max(60).optional(),
  from: isoDateTimeSchema.optional(),
  to: isoDateTimeSchema.optional(),
});

export const auditIntegritySchema = z.object({
  verified: z.boolean(),
  checkedEvents: z.int().nonnegative(),
  firstBrokenSequence: z.int().nullable(),
  checkedAt: isoDateTimeSchema,
});

/** Four-eyes control. The requester can never be the approver. */
export const approvalRequestSchema = z.object({
  id: idSchema,
  kind: z.enum([
    'manual_posting',
    'high_value_transfer',
    'limit_change',
    'account_closure',
    'loan_override',
    'refund',
    'write_off',
  ]),
  summary: z.string(),
  payload: z.record(z.string(), z.unknown()),
  amount: moneySchema.nullable(),
  requestedBy: z.string(),
  requestedAt: isoDateTimeSchema,
  status: z.enum(['pending', 'approved', 'rejected', 'expired']),
  decidedBy: z.string().nullable(),
  decidedAt: isoDateTimeSchema.nullable(),
  reason: z.string().nullable(),
  expiresAt: isoDateTimeSchema,
});

export const decideApprovalRequestSchema = z.object({
  decision: z.enum(['approve', 'reject']),
  reason: z.string().min(4).max(1000),
});

export const approvalInboxQuerySchema = z.object({
  status: approvalRequestSchema.shape.status.optional(),
  kind: approvalRequestSchema.shape.kind.optional(),
});

export type StaffUser = z.infer<typeof staffUserSchema>;
export type AuditEvent = z.infer<typeof auditEventSchema>;
export type ApprovalRequest = z.infer<typeof approvalRequestSchema>;
export type ApprovalInboxQuery = z.infer<typeof approvalInboxQuerySchema>;
