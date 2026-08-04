import { proxyApiDownload } from '@/features/transactions/proxy-download';

type Params = Promise<{ transactionId: string }>;

/** Printable HTML receipt for one transaction, proxied from the API (ADR-09). */
export async function GET(_request: Request, { params }: { params: Params }) {
  const { transactionId } = await params;
  return proxyApiDownload(`/transactions/${encodeURIComponent(transactionId)}/receipt`);
}
