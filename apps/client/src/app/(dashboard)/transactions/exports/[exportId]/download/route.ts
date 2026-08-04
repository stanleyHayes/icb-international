import { proxyApiDownload } from '@/features/transactions/proxy-download';

type Params = Promise<{ exportId: string }>;

/** Streams a generated CSV/OFX/PDF export from the API with the session token attached. */
export async function GET(_request: Request, { params }: { params: Params }) {
  const { exportId } = await params;
  return proxyApiDownload(`/transactions/exports/${encodeURIComponent(exportId)}/download`);
}
