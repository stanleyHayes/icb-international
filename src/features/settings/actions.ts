'use server';

import { redirect } from 'next/navigation';

import { api } from '@/lib/api';
import { clearSession } from '@/lib/session';

/**
 * Ends every session for this user, server-side, then clears the local one.
 *
 * The API revokes the token family; clearing the cookie afterwards only tidies up this browser.
 * Doing it in that order means a failure still leaves the account protected.
 */
export async function signOutEverywhereAction(): Promise<void> {
  await api<{ revoked: number }>('/auth/logout-all', { method: 'POST' });
  await clearSession();
  redirect('/login');
}
