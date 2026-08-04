import 'server-only';

import { readSession } from '@/lib/session';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100/v1';

const PASSTHROUGH_HEADERS = ['content-type', 'content-disposition', 'cache-control'] as const;

/**
 * Streams an authenticated API download (receipt, export) back to the browser.
 *
 * ADR-09: the browser never calls the API directly, so a file that lives behind the bearer
 * token is proxied here — the token comes out of the sealed session cookie server-side and
 * only the bytes cross to the client.
 */
export async function proxyApiDownload(path: string): Promise<Response> {
  const session = await readSession();
  if (!session) {
    return new Response('Sign in to download this file.', { status: 401 });
  }

  const upstream = await fetch(`${API_URL}${path}`, {
    headers: { authorization: `Bearer ${session.accessToken}` },
    cache: 'no-store',
  });

  if (!upstream.ok || upstream.body === null) {
    return new Response('This file is not available.', { status: upstream.ok ? 502 : upstream.status });
  }

  const headers = new Headers();
  for (const name of PASSTHROUGH_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: 200, headers });
}
