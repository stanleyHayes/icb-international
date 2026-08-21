import type { Metadata } from 'next';

import { NotFoundView } from '@/components/not-found-view';

/**
 * 404.
 *
 * Renders inside the site header and footer, so it keeps the page navigable rather than
 * stranding a visitor on a dead end.
 *
 * `index: false` keeps the page out of search results while `follow: true` still lets a crawler
 * use the links on it — a 404 that is indexed becomes a soft-404 and costs crawl budget.
 *
 * This stays a server component so it can export metadata; the pathname is read one level down,
 * in a client child, because `usePathname` and `export const metadata` cannot share a file.
 */
export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return <NotFoundView />;
}
