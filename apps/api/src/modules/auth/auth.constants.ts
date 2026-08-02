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

/** How long an email verification or password reset token stays valid. */
export const EMAIL_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Trusted devices skip MFA for this long. */
export const TRUSTED_DEVICE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const REFRESH_COOKIE_NAME = 'icb_refresh';
