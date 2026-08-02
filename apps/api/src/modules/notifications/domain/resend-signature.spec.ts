import { Buffer } from 'node:buffer';
import { createHmac, randomBytes } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { verifyWebhookSignature, type WebhookSignatureHeaders } from './resend-signature.js';

/**
 * These tests sign the payload the way Resend does — HMAC-SHA256 over `id.timestamp.body`,
 * base64 — rather than asserting against a captured fixture, so a mistake in the verifier cannot
 * be papered over by an equally wrong expectation.
 */

const KEY = randomBytes(24);
const SECRET = `whsec_${KEY.toString('base64')}`;
const ID = 'msg_2abcDEF';
const NOW_MS = Date.UTC(2026, 7, 2, 12, 0, 0);
const TIMESTAMP = String(Math.floor(NOW_MS / 1000));
const PAYLOAD = JSON.stringify({ type: 'email.delivered', data: { email_id: 'e_1' } });

function sign(payload: string, timestamp = TIMESTAMP): string {
  return createHmac('sha256', KEY).update(`${ID}.${timestamp}.${payload}`, 'utf8').digest('base64');
}

const headers: WebhookSignatureHeaders = {
  id: ID,
  timestamp: TIMESTAMP,
  signature: `v1,${sign(PAYLOAD)}`,
};

describe('verifyWebhookSignature', () => {
  it('accepts a correctly signed payload', () => {
    expect(verifyWebhookSignature({ payload: PAYLOAD, headers, secret: SECRET, nowMs: NOW_MS })).toBe(
      'verified',
    );
  });

  it('accepts a raw base64 secret without the whsec_ prefix', () => {
    const secret = KEY.toString('base64');
    expect(verifyWebhookSignature({ payload: PAYLOAD, headers, secret, nowMs: NOW_MS })).toBe(
      'verified',
    );
  });

  it('rejects a body that changed by a single byte', () => {
    const outcome = verifyWebhookSignature({
      payload: `${PAYLOAD} `,
      headers,
      secret: SECRET,
      nowMs: NOW_MS,
    });
    expect(outcome).toBe('invalid');
  });

  it('rejects a signature produced with a different key', () => {
    const foreign = createHmac('sha256', randomBytes(24))
      .update(`${ID}.${TIMESTAMP}.${PAYLOAD}`, 'utf8')
      .digest('base64');

    const outcome = verifyWebhookSignature({
      payload: PAYLOAD,
      headers: { ...headers, signature: `v1,${foreign}` },
      secret: SECRET,
      nowMs: NOW_MS,
    });
    expect(outcome).toBe('invalid');
  });

  it('rejects a replay from outside the tolerance window', () => {
    const outcome = verifyWebhookSignature({
      payload: PAYLOAD,
      headers,
      secret: SECRET,
      nowMs: NOW_MS + 3_600_000,
    });
    expect(outcome).toBe('stale');
  });

  it('accepts a request inside the tolerance window', () => {
    const outcome = verifyWebhookSignature({
      payload: PAYLOAD,
      headers,
      secret: SECRET,
      nowMs: NOW_MS + 120_000,
    });
    expect(outcome).toBe('verified');
  });

  it('accepts any one of several rotated signatures', () => {
    const outcome = verifyWebhookSignature({
      payload: PAYLOAD,
      headers: { ...headers, signature: `v1,AAAAAAAA v1,${sign(PAYLOAD)}` },
      secret: SECRET,
      nowMs: NOW_MS,
    });
    expect(outcome).toBe('verified');
  });

  it('ignores signature entries of an unknown version', () => {
    const outcome = verifyWebhookSignature({
      payload: PAYLOAD,
      headers: { ...headers, signature: `v2,${sign(PAYLOAD)}` },
      secret: SECRET,
      nowMs: NOW_MS,
    });
    expect(outcome).toBe('invalid');
  });

  it('reports missing headers rather than failing verification', () => {
    const outcome = verifyWebhookSignature({
      payload: PAYLOAD,
      headers: { id: null, timestamp: TIMESTAMP, signature: null },
      secret: SECRET,
      nowMs: NOW_MS,
    });
    expect(outcome).toBe('missing_headers');
  });

  it('reports that verification is disabled when no secret is configured', () => {
    expect(verifyWebhookSignature({ payload: PAYLOAD, headers, secret: '', nowMs: NOW_MS })).toBe(
      'unverified',
    );
  });

  it('rejects a non-numeric timestamp instead of treating it as fresh', () => {
    const outcome = verifyWebhookSignature({
      payload: PAYLOAD,
      headers: { ...headers, timestamp: 'yesterday' },
      secret: SECRET,
      nowMs: NOW_MS,
    });
    expect(outcome).toBe('stale');
  });
});
