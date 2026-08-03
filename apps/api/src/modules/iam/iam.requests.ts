import { approvalRequestSchema, staffRoleSchema } from '@icb/contracts';
import { z } from 'zod';

/**
 * Server-side input shapes for IAM routes that have no contract request schema of their own
 * (the governance SDK surface only declares staff create + approval decision bodies).
 * These compose contract primitives rather than redefining contract types.
 */

export const updateStaffUserRequestSchema = z
  .object({
    roles: z.array(staffRoleSchema).min(1).optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => value.roles !== undefined || value.active !== undefined, {
    error: 'At least one of roles or active is required',
  });

export type UpdateStaffUserRequest = z.infer<typeof updateStaffUserRequestSchema>;

export const approvalInboxQuerySchema = z.object({
  status: approvalRequestSchema.shape.status.optional(),
  kind: approvalRequestSchema.shape.kind.optional(),
});

export type ApprovalInboxQueryInput = z.infer<typeof approvalInboxQuerySchema>;
