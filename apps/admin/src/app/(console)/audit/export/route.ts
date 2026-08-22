import { type NextRequest, NextResponse } from 'next/server';

import { readSession } from '@/lib/session';
import { resolveApiBaseUrl } from '@icb/contracts';

const API_URL = resolveApiBaseUrl(process.env.NEXT_PUBLIC_API_URL, 'http://localhost:4100/v1');

/**
 * NDJSON export of the filtered audit trail.
 *
 * The browser cannot call the API directly (ADR-09 — the token never leaves the sealed
 * session), so this route proxies the API's export with the operator's bearer token and
 * hands the stream back as a download. One event per line, in chain order.
 */
export async function GET(request: NextRequest) {
  const session = await readSession();
  if (!session) {
    return NextResponse.json({ detail: 'Unauthenticated' }, { status: 401 });
  }

  const upstream = await fetch(`${API_URL}/admin/audit/export${request.nextUrl.search}`, {
    headers: { authorization: `Bearer ${session.accessToken}`, accept: 'application/x-ndjson' },
    cache: 'no-store',
  });

  if (!upstream.ok) {
    return new NextResponse(await upstream.text(), { status: upstream.status });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/x-ndjson',
      'content-disposition': `attachment; filename="icb-audit-export.ndjson"`,
    },
  });
}
