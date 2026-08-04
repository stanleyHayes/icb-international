import { loanDecisionSchema, moneySchema } from '@icb/contracts';
import { z } from 'zod';

/**
 * Staff lending vocabulary.
 *
 * The queue, decision and disbursement endpoints exist today (`/loans/admin/…`); the portfolio,
 * loan-detail, restructure and write-off paths are the staff counterparts of the customer
 * lending API and are consumed here ahead of their contract (see the mission report).
 *
 * The decision body mirrors the API's own staff schema: composed from the contract's
 * `loanDecisionSchema` pieces so the vocabulary cannot drift from the decision it produces.
 */
export const LOAN_PATHS = {
  queue: '/loans/admin/queue',
  application: (applicationId: string) => `/loans/admin/applications/${applicationId}`,
  decide: (applicationId: string) => `/loans/admin/applications/${applicationId}/decision`,
  portfolio: '/loans/admin/portfolio',
  loan: (loanId: string) => `/loans/admin/${loanId}`,
  disburse: (loanId: string) => `/loans/admin/${loanId}/disburse`,
  restructure: (loanId: string) => `/loans/admin/${loanId}/restructure`,
  writeOff: (loanId: string) => `/loans/admin/${loanId}/write-off`,
} as const;

const justificationSchema = z
  .string()
  .min(10, 'Justify the decision in at least 10 characters — it is shown to the applicant')
  .max(300);

/**
 * An underwriting decision. Unlike the scorecard, a human decision always carries its
 * justification: an override without a reason is an override that cannot be audited.
 */
export const staffDecisionFormSchema = z
  .object({
    outcome: loanDecisionSchema.shape.outcome,
    justification: justificationSchema,
    approvedAmount: moneySchema.optional(),
    approvedRate: z.number().nonnegative().max(100).optional(),
  })
  .refine((value) => value.outcome !== 'approved' || value.approvedAmount !== undefined, {
    path: ['approvedAmount'],
    message: 'State the approved amount — even when it matches the request',
  });

export const restructureFormSchema = z
  .object({
    termMonths: z.int().positive().max(480).optional(),
    rate: z.number().nonnegative().max(100).optional(),
    reason: justificationSchema,
  })
  .refine((value) => value.termMonths !== undefined || value.rate !== undefined, {
    path: ['termMonths'],
    message: 'Change the term, the rate, or both',
  });

export const writeOffFormSchema = z.object({ reason: justificationSchema });

export type StaffDecisionForm = z.infer<typeof staffDecisionFormSchema>;
