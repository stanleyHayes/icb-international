'use server';

import { revalidatePath } from 'next/cache';

import { api } from '@/lib/api';

/**
 * End one session on another device.
 *
 * The current session cannot be revoked from this list — leaving the device in your hand signed
 * in is never the right outcome of tidying up — so the UI never offers it and the server action
 * re-checks anyway.
 */
export async function revokeSessionAction(sessionId: string, isCurrent: boolean): Promise<void> {
  if (isCurrent) {
    return;
  }
  await api<void>(`/auth/sessions/${sessionId}`, { method: 'DELETE' });
  revalidatePath('/account/security');
}
