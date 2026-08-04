import { ogImage } from '@/lib/seo/og-image';

export const alt = 'ICB — International Commercial Bank. Banking, exactly.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/** The site-wide default card; routes with their own `opengraph-image` override it. */
export default function OpengraphImage() {
  return ogImage(
    'Banking, exactly.',
    'Current accounts, savings, cards, lending and international payments — built on a ledger that balances to the cent.',
  );
}
