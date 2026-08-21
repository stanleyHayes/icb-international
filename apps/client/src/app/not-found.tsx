import type { Metadata } from 'next';

import { NotFoundView } from '@/components/not-found-view';

/**
 * 404.
 *
 * Reassurance leads: a dead link inside a bank raises a question about money, and the copy
 * answers it before offering a way back.
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
