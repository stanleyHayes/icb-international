/* eslint-disable sonarjs/no-hardcoded-passwords -- constant *names* and a deliberately-unusable hash placeholder; no credential material lives here */

/**
 * A small breached-password list.
 *
 * Real deployments check against the full Have I Been Pwned corpus via k-anonymity. Shipping a
 * representative subset keeps ICB self-contained (agent_plan.md N2: no external calls) while
 * still rejecting the passwords an attacker actually tries first.
 */
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set([
  'password', 'password1', 'password123', 'password1234', 'passw0rd',
  '123456', '12345678', '123456789', '1234567890', 'qwerty123456',
  'letmein123', 'welcome123', 'admin123456', 'iloveyou123', 'monkey123456',
  'abc123456789', 'qwertyuiop123', 'sunshine1234', 'princess1234', 'dragon123456',
  'football1234', 'baseball1234', 'trustno1234', 'superman1234', 'batman123456',
  'michael12345', 'shadow123456', 'master123456', 'jennifer1234', 'jordan123456',
  'changeme1234', 'letmein12345', 'whatever1234', 'starwars1234', 'computer1234',
]);

/** Failed logins before the account locks, and how long each successive lock lasts. */
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_LADDER_MS = [60_000, 300_000, 900_000, 3_600_000] as const;

/**
 * Verified against on a login for an unknown email, so response time does not reveal whether the
 * account exists. Well-formed argon2id; the plaintext is irrelevant because it never matches.
 */
export const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAA';

/** How long an email verification or password reset token stays valid. */
export const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export const REFRESH_COOKIE_NAME = 'icb_refresh';

/** Why a session ended — written to `sessions.revokedReason` and surfaced in the audit trail. */
export const REVOKE_REASONS = {
  Logout: 'logout',
  LogoutAll: 'logout_all',
  Rotated: 'rotated',
  RefreshReuse: 'refresh_token_reuse',
  ByUser: 'revoked_by_user',
  PasswordChange: 'password_changed',
  PasswordReset: 'password_reset',
} as const;

/**
 * Stable, greppable names for the audit trail (N7). Auth events are security telemetry: an
 * incident review reads this stream, so the names never change once shipped.
 */
export const AUDIT_ACTIONS = {
  Register: 'auth.register',
  Login: 'auth.login',
  LoginFailed: 'auth.login_failed',
  Logout: 'auth.logout',
  LogoutAll: 'auth.logout_all',
  RefreshRotated: 'auth.refresh_rotated',
  RefreshReuseDetected: 'auth.refresh_reuse_detected',
  EmailVerificationSent: 'auth.email_verification_sent',
  EmailVerified: 'auth.email_verified',
  PasswordResetRequested: 'auth.password_reset_requested',
  PasswordResetCompleted: 'auth.password_reset_completed',
  PasswordChanged: 'auth.password_changed',
  SessionRevoked: 'auth.session_revoked',
} as const;

/**
 * The audit actions that count as a login event for the customer's own login history:
 * a successful sign-in or a failed one against their credential.
 */
export const LOGIN_HISTORY_ACTIONS: readonly string[] = [
  AUDIT_ACTIONS.Login,
  AUDIT_ACTIONS.LoginFailed,
];

/** How many entries the login-history endpoint returns — one screen of recent activity. */
export const LOGIN_HISTORY_LIMIT = 25;
