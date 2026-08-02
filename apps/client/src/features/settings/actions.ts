'use server';

import { redirect } from 'next/navigation';

import { api } from '@/lib/api';
import { clearSession } from '@/lib/session';

/**
 * Ends every session for this user, server-side, then clears the local one.
 *
 * The API revokes the whole token family first; clearing the cookie afterwards only tidies up
 * this browser. Doing it in that order means a failure part-way still leaves the account
 * protected rather than merely appearing to be.
 */
export async function signOutEverywhereAction(): Promise<void> {
  await api<{ revoked: number }>('/auth/logout-all', { method: 'POST' });
  await clearSession();
  redirect('/login');
}
