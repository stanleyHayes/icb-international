import 'server-only';

import type { AuthenticatedUser, AuthTokens } from '@icb/contracts';

import { writeSession } from '@/lib/session';

/**
 * Seal a freshly issued token pair into the session cookie.
 *
 * Shared by the login and MFA-verify actions, which are the only two places a session is born.
 * The refresh token travels back as the API's `Set-Cookie` header and is stored verbatim — this
 * server forwards it on refresh without ever parsing it.
 */
export async function establishSession(
  setCookieHeader: string | null,
  tokens: AuthTokens,
  user: AuthenticatedUser,
): Promise<void> {
  await writeSession({
    accessToken: tokens.accessToken,
    refreshCookie: setCookieHeader ?? '',
    expiresAt: Date.now() + tokens.expiresIn * 1000,
    user: {
      userId: user.userId,
      customerId: user.customerId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  });
}
