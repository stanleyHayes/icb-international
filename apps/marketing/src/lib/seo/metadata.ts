import type { Metadata } from 'next';

export const SITE_NAME = 'ICB International Commercial Bank';
export const BASE_URL = process.env.NEXT_PUBLIC_MARKETING_URL ?? 'http://localhost:3100';

/**
 * The full metadata block for a marketing route.
 *
 * Every route gets a canonical URL, Open Graph fields that resolve against the shared OG image,
 * and a Twitter card, so a link shared from any page unfurls identically. The root layout
 * supplies `metadataBase`, so `canonical` stays a relative path here.
 */
export function pageMetadata({
  title,
  description,
  path,
}: Readonly<{ title: string; description: string; path: string }>): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      url: path,
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}
