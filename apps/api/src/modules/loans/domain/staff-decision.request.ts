import { loanDecisionSchema, moneySchema } from '@icb/contracts';
import { z } from 'zod';

/**
 * The body an underwriter sends when overriding the scorecard.
 *
 * There is no contract DTO for this because it never crosses a customer boundary — it is a
 * back-office instruction, not part of the published lending API. Its shape is composed from the
 * contract's own pieces (`loanDecisionSchema.shape.outcome`, `moneySchema`) so the vocabulary
 * cannot drift from the decision it produces.
 */
export const staffLoanDecisionRequestSchema = z.object({
  outcome: loanDecisionSchema.shape.outcome,
  /** Approve for less than was asked for. Omitted means "whatever the scorecard supports". */
  approvedAmount: moneySchema.optional(),
  approvedRate: z.number().nonnegative().max(100).optional(),
  /** Shown verbatim to the applicant, so it must read as a sentence. */
  reasons: z.array(z.string().min(1).max(300)).max(10).optional(),
});

export type StaffLoanDecisionRequest = z.infer<typeof staffLoanDecisionRequestSchema>;
