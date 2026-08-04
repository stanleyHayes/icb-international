import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_MARKETING_URL ?? 'http://localhost:3100';

export default function robots(): MetadataRoute.Robots {
  const allowIndexing = process.env.NODE_ENV === 'production';
  return {
    rules: allowIndexing
      ? { userAgent: '*', allow: '/' }
      : { userAgent: '*', disallow: '/' },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
