import { registerRequestSchema } from '@icb/contracts';
import { CURRENCY_CODES } from '@icb/money';
import { z } from 'zod';

/**
 * The application funnel's draft shape.
 *
 * The credential fields come straight from the registration contract so client-side validation
 * can never drift from what `/auth/register` will accept. The product choices are intent only —
 * registration creates the customer and KYC case; accounts are opened after identity checks.
 */
export const applicationSchema = registerRequestSchema
  .omit({ acceptedTermsVersion: true })
  .extend({
    currency: z.enum(CURRENCY_CODES),
    addSavings: z.boolean(),
    acceptedTerms: z
      .boolean()
      .refine((value) => value, { error: 'You need to accept the terms to open an account' }),
  });

export type ApplicationDraft = z.infer<typeof applicationSchema>;

export const APPLICATION_DEFAULTS: ApplicationDraft = {
  currency: 'GHS',
  addSavings: false,
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  password: '',
  acceptedTerms: false,
};

export interface FunnelStep {
  readonly id: string;
  readonly title: string;
  readonly fields: readonly (keyof ApplicationDraft)[];
}

export const FUNNEL_STEPS: readonly FunnelStep[] = [
  { id: 'product', title: 'Your account', fields: ['currency', 'addSavings'] },
  { id: 'personal', title: 'Your name', fields: ['firstName', 'lastName'] },
  { id: 'identity', title: 'Sign-in details', fields: ['email', 'phone', 'password'] },
  { id: 'review', title: 'Review & confirm', fields: ['acceptedTerms'] },
];

/** Maps a server-side field error back to the step that owns the field. */
export function stepForField(field: string): number {
  const index = FUNNEL_STEPS.findIndex((step) =>
    (step.fields as readonly string[]).includes(field),
  );
  return index === -1 ? FUNNEL_STEPS.length - 1 : index;
}
