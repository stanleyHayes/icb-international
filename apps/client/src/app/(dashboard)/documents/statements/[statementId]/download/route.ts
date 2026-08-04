import type { DownloadLink } from '@icb/contracts';
import { NextResponse } from 'next/server';

import { api } from '@/lib/api';

/**
 * Statement download. The browser asks this server route; the server mints a short-lived signed
 * URL against the API and redirects to it. The signed URL therefore never passes through the
 * client bundle, and a stale link simply expires rather than leaking.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ statementId: string }> },
) {
  const { statementId } = await params;
  const link = await api<DownloadLink>(`/statements/${statementId}/download`);
  return NextResponse.redirect(link.url);
}
