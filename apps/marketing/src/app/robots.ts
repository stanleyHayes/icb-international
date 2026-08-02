import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_MARKETING_URL ?? 'http://localhost:3100';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
