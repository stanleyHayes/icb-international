import type { MetadataRoute } from 'next';

import { NEWS_ARTICLES } from '@/content/company';
import { BUSINESS_PAGES, PERSONAL_PAGES, WEALTH_PAGES } from '@/content/product-pages';

const BASE = process.env.NEXT_PUBLIC_MARKETING_URL ?? 'http://localhost:3100';

const ROUTES = [
  { path: '', priority: 1, changeFrequency: 'weekly' },
  { path: '/personal', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/business', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/wealth', priority: 0.9, changeFrequency: 'weekly' },
  { path: '/open-account', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/rates', priority: 0.8, changeFrequency: 'hourly' },
  { path: '/tools', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/security', priority: 0.7, changeFrequency: 'monthly' },
  { path: '/security/fraud-awareness', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/security/deposit-protection', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/support', priority: 0.7, changeFrequency: 'weekly' },
  { path: '/support/branches', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/contact', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/complaints', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/about', priority: 0.6, changeFrequency: 'monthly' },
  { path: '/careers', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/newsroom', priority: 0.6, changeFrequency: 'weekly' },
  { path: '/legal/terms', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/privacy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/cookies', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/legal/accessibility', priority: 0.3, changeFrequency: 'yearly' },
] as const;

const PRODUCT_PAGES = [...PERSONAL_PAGES, ...BUSINESS_PAGES, ...WEALTH_PAGES];

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = ROUTES.map((route) => ({
    url: `${BASE}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));

  const products: MetadataRoute.Sitemap = PRODUCT_PAGES.map((product) => ({
    url: `${BASE}${product.categoryHref}/${product.slug}`,
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const articles: MetadataRoute.Sitemap = NEWS_ARTICLES.map((article) => ({
    url: `${BASE}/newsroom/${article.slug}`,
    changeFrequency: 'monthly',
    priority: 0.4,
  }));

  return [...staticRoutes, ...products, ...articles];
}
