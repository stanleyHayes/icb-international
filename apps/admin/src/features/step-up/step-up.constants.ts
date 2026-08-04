/**
 * Step-up purposes for the console's sensitive operations.
 *
 * The value must match the `@RequireStepUp(...)` purpose on the API handler the proof unlocks
 * (`iam.constants.ts`), so a proof minted for one action cannot authorise another.
 */
export const STEP_UP_PURPOSE = {
  staffManage: 'staff-manage',
} as const;

export type StepUpPurpose = (typeof STEP_UP_PURPOSE)[keyof typeof STEP_UP_PURPOSE];
