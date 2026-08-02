import 'server-only';

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

import { cookies } from 'next/headers';

/**
 * Server-side session.
 *
 * The access token never reaches the browser. It lives inside an AES-256-GCM sealed cookie that
 * only this server can open, and every API call is made from a Server Component or Server Action.
 * A script injected into the page therefore has nothing to steal — which is the whole reason the
 * dashboard is built on RSC rather than as a client-side SPA (ADR-09).
 */

const COOKIE_NAME = 'icb_session';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

export interface SessionData {
  accessToken: string;
  refreshCookie: string;
  expiresAt: number;
  user: {
    userId: string;
    customerId: string | null;
    email: string;
    firstName: string;
    lastName: string;
  };
}

function key(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET must be set to at least 16 characters');
  }
  return scryptSync(secret, 'icb-session-v1', 32);
}

function seal(data: SessionData): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString('base64url');
}

function open(sealed: string): SessionData | null {
  try {
    const raw = Buffer.from(sealed, 'base64url');
    const iv = raw.subarray(0, IV_LENGTH);
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const body = raw.subarray(IV_LENGTH + TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key(), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
    return JSON.parse(json) as SessionData;
  } catch {
    // A tampered or stale cookie is indistinguishable from no session, and is treated as such.
    return null;
  }
}

export async function readSession(): Promise<SessionData | null> {
  const store = await cookies();
  const sealed = store.get(COOKIE_NAME)?.value;
  return sealed ? open(sealed) : null;
}

export async function writeSession(data: SessionData): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, seal(data), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}
