import type { MetadataRoute } from 'next';

const BASE = process.env.NEXT_PUBLIC_MARKETING_URL ?? 'http://localhost:3100';

const ROUTES = [
  { path: '', priority: 1 },
  { path: '/personal', priority: 0.9 },
  { path: '/business', priority: 0.9 },
  { path: '/rates', priority: 0.8 },
  { path: '/security', priority: 0.7 },
  { path: '/support', priority: 0.7 },
  { path: '/about', priority: 0.6 },
  { path: '/open-account', priority: 0.9 },
  { path: '/legal/terms', priority: 0.3 },
  { path: '/legal/privacy', priority: 0.3 },
  { path: '/legal/cookies', priority: 0.3 },
  { path: '/legal/accessibility', priority: 0.3 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `${BASE}${route.path}`,
    changeFrequency: 'weekly',
    priority: route.priority,
  }));
}
