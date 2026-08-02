import { Buffer } from 'node:buffer';
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Standard Webhooks signature verification, as Resend sends it.
 *
 * Implemented here rather than delegated to `resend.webhooks.verify` for one reason: the webhook
 * receiver has to work when no API key is configured and therefore no Resend client exists. The
 * scheme is small and public — HMAC-SHA256 over `id.timestamp.body`, base64 — so re-stating it
 * costs a dozen lines and removes a hard dependency from the one endpoint the internet can call.
 */

export interface WebhookSignatureHeaders {
  readonly id: string | null;
  readonly timestamp: string | null;
  readonly signature: string | null;
}

export type SignatureOutcome = 'verified' | 'unverified' | 'missing_headers' | 'stale' | 'invalid';

export interface VerifyInput {
  readonly payload: string;
  readonly headers: WebhookSignatureHeaders;
  readonly secret: string;
  /** Clock-derived. Never `Date.now()` — replay windows move with simulated time like everything else. */
  readonly nowMs: number;
}

const SECRET_PREFIX = 'whsec_';
const TOLERANCE_SECONDS = 300;

export function verifyWebhookSignature(input: VerifyInput): SignatureOutcome {
  if (input.secret === '') {
    // Accepted, but the caller is expected to say so loudly in the log.
    return 'unverified';
  }

  const { id, timestamp, signature } = input.headers;
  if (id === null || timestamp === null || signature === null) {
    return 'missing_headers';
  }
  if (!isFresh(timestamp, input.nowMs)) {
    return 'stale';
  }

  const expected = sign(input.secret, `${id}.${timestamp}.${input.payload}`);
  return matchesAny(signature, expected) ? 'verified' : 'invalid';
}

/**
 * A signature that was valid an hour ago is a replay. Rejecting outside the window is the only
 * part of this scheme that stops a captured request being posted back at us repeatedly.
 */
function isFresh(timestamp: string, nowMs: number): boolean {
  const sentSeconds = Number(timestamp);
  if (!Number.isFinite(sentSeconds)) {
    return false;
  }
  return Math.abs(nowMs / 1000 - sentSeconds) <= TOLERANCE_SECONDS;
}

function sign(secret: string, signedContent: string): Buffer {
  const material = secret.startsWith(SECRET_PREFIX)
    ? secret.slice(SECRET_PREFIX.length)
    : secret;
  const key = Buffer.from(material, 'base64');
  return createHmac('sha256', key).update(signedContent, 'utf8').digest();
}

/**
 * The header carries a space-separated list so a secret can be rotated without downtime; any one
 * entry matching is a pass. Comparison is constant-time — a byte-by-byte early exit on a MAC is
 * a textbook timing oracle.
 */
function matchesAny(header: string, expected: Buffer): boolean {
  return header
    .split(' ')
    .map(versionedSignature)
    .some((candidate) => candidate !== null && equalsConstantTime(candidate, expected));
}

function versionedSignature(entry: string): Buffer | null {
  const [version, encoded] = entry.split(',');
  if (version !== 'v1' || encoded === undefined || encoded === '') {
    return null;
  }
  return Buffer.from(encoded, 'base64');
}

function equalsConstantTime(candidate: Buffer, expected: Buffer): boolean {
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}
