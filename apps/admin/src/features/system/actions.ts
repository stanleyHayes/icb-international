'use server';

import { updateFeatureFlagRequestSchema } from '@icb/contracts';
import { revalidatePath } from 'next/cache';

import { ApiError, api } from '@/lib/api';

export interface FlagFormState {
  status: 'idle' | 'error' | 'saved';
  message: string | null;
}

// The initial form state lives in flag-row.tsx: a 'use server' module may only export async
// functions, so the constant cannot be shared from here.

/**
 * Update a feature flag.
 *
 * Enable/disable flips immediately from the switch; rollout and audience changes come through
 * the same action. The API is the enforcement point (`super_admin` only) — this action just
 * carries the intent and surfaces its answer.
 */
export async function updateFlagAction(
  _previous: FlagFormState,
  formData: FormData,
): Promise<FlagFormState> {
  const keyRaw = formData.get('key');
  const key = typeof keyRaw === 'string' ? keyRaw : '';
  if (!key) {
    return { status: 'error', message: 'Missing flag key.' };
  }

  const rolloutRaw = formData.get('rolloutPercentage');
  const parsed = updateFeatureFlagRequestSchema.safeParse({
    ...(formData.get('enabled') !== null
      ? { enabled: formData.get('enabled') === 'true' }
      : {}),
    ...(typeof rolloutRaw === 'string' && rolloutRaw !== ''
      ? { rolloutPercentage: Number(rolloutRaw) }
      : {}),
    ...(formData.get('audience') ? { audience: formData.get('audience') } : {}),
  });

  if (!parsed.success) {
    return { status: 'error', message: 'Check the rollout percentage — it must be 0 to 100.' };
  }

  try {
    await api(`/simulation/flags/${key}`, { method: 'PATCH', body: parsed.data });
    revalidatePath('/system/flags');
    return { status: 'saved', message: null };
  } catch (error) {
    return {
      status: 'error',
      message:
        error instanceof ApiError
          ? error.problem.detail
          : 'The flag could not be updated. Please try again.',
    };
  }
}
