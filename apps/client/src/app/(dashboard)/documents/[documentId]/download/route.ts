import type { DownloadLink } from '@icb/contracts';
import { NextResponse } from 'next/server';

import { api } from '@/lib/api';

/**
 * Document download. Same flow as statements: a fresh signed URL per click, minted server-side,
 * followed by a redirect straight to the storage provider.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  const { documentId } = await params;
  const link = await api<DownloadLink>(`/documents/${documentId}/download`);
  return NextResponse.redirect(link.url);
}
