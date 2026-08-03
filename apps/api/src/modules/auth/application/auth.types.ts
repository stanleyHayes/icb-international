import type { AuthenticatedUser } from '@icb/contracts';

/** Where a request came from. Attached to sessions, challenges, and the audit trail. */
export interface DeviceContext {
  readonly deviceId: string | null;
  readonly userAgent: string;
  readonly ipAddress: string;
}

/** What a completed authentication yields: an access token for the body, a refresh for the cookie. */
export interface IssuedSession {
  readonly accessToken: string;
  readonly expiresIn: number;
  readonly refreshToken: string;
  readonly refreshTtlMs: number;
  readonly user: AuthenticatedUser;
}
