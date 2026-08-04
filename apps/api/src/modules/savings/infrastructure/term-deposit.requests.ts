import { idSchema } from '@icb/contracts';
import { z } from 'zod';

const MATURITY_INSTRUCTIONS = ['rollover_principal', 'rollover_all', 'transfer_out'] as const;

/**
 * The only terms of a live deposit a customer may change their mind about: what happens at
 * maturity. Defined locally until a savings contract schema lands. At least one field is
 * required — an empty patch is a client bug, not a no-op.
 */
export const updateTermDepositRequestSchema = z
  .object({
    maturityInstruction: z.enum(MATURITY_INSTRUCTIONS).optional(),
    /** `null` clears a previously nominated rollover account. */
    rolloverAccountId: idSchema.nullable().optional(),
  })
  .refine((patch) => patch.maturityInstruction !== undefined || patch.rolloverAccountId !== undefined, {
    message: 'At least one of maturityInstruction or rolloverAccountId is required',
  });

export type UpdateTermDepositRequest = z.infer<typeof updateTermDepositRequestSchema>;
