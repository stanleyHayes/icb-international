/**
 * Keys whose values must never reach a log line (§11 data protection).
 *
 * Matched case-insensitively, and also as a suffix so compound names such as `accessToken`,
 * `cardCvv` or `nationalId` are caught. The list is deliberately short and scary — adding a key
 * here is cheap, un-leaking a PAN is not.
 */
export const SENSITIVE_KEYS: readonly string[] = [
  'pan',
  'cvv',
  'password',
  'token',
  'authorization',
  'dob',
  'nationalid',
];

export const REDACTED_VALUE = '[redacted]';

/** Hard stop on recursion so a cyclic or pathological payload cannot hang the logger. */
export const MAX_REDACTION_DEPTH = 8;
