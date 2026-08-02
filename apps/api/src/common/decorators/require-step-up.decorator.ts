import { SetMetadata, type CustomDecorator } from '@nestjs/common';

export const STEP_UP_KEY = 'icb:stepUp';

/** Header carrying the short-lived step-up token minted after a fresh second factor. */
export const STEP_UP_TOKEN_HEADER = 'x-step-up-token';

/**
 * Marks a handler as requiring a recent second-factor proof for the given purpose
 * (e.g. `pan-reveal`, `transfer-create`). Enforced by `StepUpGuard`; the token's `purpose`
 * claim must match, so a proof for one sensitive action cannot unlock another.
 */
export const RequireStepUp = (purpose: string): CustomDecorator<string> =>
  SetMetadata(STEP_UP_KEY, purpose);
