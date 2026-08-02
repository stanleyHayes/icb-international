/**
 * Log redaction.
 *
 * The privacy notice tells customers that logs are passed through a redaction filter before
 * anything is written. This is that filter, and it is the reason that statement is true.
 *
 * Two mechanisms, because one is not enough:
 *  - `REDACT_PATHS` removes known-sensitive fields wherever pino can address them by path.
 *  - `scrubText` catches values that arrive embedded in a free-text message, where a path
 *    cannot reach them — an error string containing a PAN, for instance.
 */

/**
 * Field paths pino replaces with `[redacted]`.
 *
 * Wildcards cover the nesting we actually produce: request bodies, error contexts, and the
 * arbitrary objects services pass as the first logger argument.
 */
export const REDACT_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-step-up-token"]',
  'req.headers["idempotency-key"]',
  'res.headers["set-cookie"]',
  'password',
  '*.password',
  '*.*.password',
  'newPassword',
  '*.newPassword',
  'currentPassword',
  '*.currentPassword',
  'passwordHash',
  '*.passwordHash',
  'pin',
  '*.pin',
  'pan',
  '*.pan',
  'cvv',
  '*.cvv',
  'panToken',
  '*.panToken',
  'mfaSecretEncrypted',
  '*.mfaSecretEncrypted',
  'accessToken',
  '*.accessToken',
  'refreshToken',
  '*.refreshToken',
  'tokenHash',
  '*.tokenHash',
  'secret',
  '*.secret',
  'apiKey',
  '*.apiKey',
  'signature',
  '*.signature',
  'dateOfBirth',
  '*.dateOfBirth',
  'nationalId',
  '*.nationalId',
  'documentNumber',
  '*.documentNumber',
  'recoveryCodeHashes',
  '*.recoveryCodeHashes',
];

/** 13–19 digits, optionally grouped — the shape of a card number wherever it appears. */
const PAN_PATTERN = /\b(?:\d[ -]?){12,18}\d\b/g;

/** Bearer tokens and other long opaque credentials pasted into a message. */
const BEARER_PATTERN = /\bBearer\s+[\w-]+\.?[\w-]*\.?[\w-]*/gi;

/** Anything that looks like an email address in free text. */
const EMAIL_PATTERN = /\b[\w.%+-]+@[\w.-]+\.[a-z]{2,}\b/gi;

export const REDACTED = '[redacted]';

/**
 * Scrub sensitive values out of free text.
 *
 * Emails are partially masked rather than removed: support needs to recognise which customer a
 * line refers to, and the local part's first character plus the domain is enough for that
 * without writing the address down.
 */
export function scrubText(value: string): string {
  return value
    .replaceAll(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replaceAll(PAN_PATTERN, (match) => maskDigits(match))
    .replaceAll(EMAIL_PATTERN, (match) => maskEmail(match));
}

function maskDigits(value: string): string {
  const digits = value.replaceAll(/\D/g, '');
  // Below 13 digits it is far more likely an account or reference number than a card.
  return digits.length < 13 ? value : `•••• ${digits.slice(-4)}`;
}

function maskEmail(value: string): string {
  const [local = '', domain = ''] = value.split('@');
  return `${local.slice(0, 1)}•••@${domain}`;
}
