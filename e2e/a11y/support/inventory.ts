import fs from 'node:fs';
import path from 'node:path';

import { APP_DIRS, REPO_ROOT, type AppName } from './paths';

/**
 * Route inventory, built from the apps' app dirs at spec-load time.
 *
 * Every `page.tsx` under `apps/<app>/src/app` is one route. Route groups `(group)` are
 * stripped, dynamic segments `[param]` become `{param}` tokens. Marketing tokens are
 * expanded immediately from the content files (they are static params); client/admin
 * tokens are resolved at runtime from the seeded database (see resolvers.ts).
 */

export type AuthLevel = 'public' | 'customer' | 'staff';

export interface RouteEntry {
  readonly app: AppName;
  /** URL path with `{token}` placeholders for unresolved dynamic segments. */
  readonly path: string;
  readonly auth: AuthLevel;
  readonly tokens: readonly string[];
}

const CLIENT_PUBLIC_PATHS = new Set([
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/recover',
]);

function authFor(app: AppName, routePath: string): AuthLevel {
  if (app === 'marketing') {
    return 'public';
  }
  if (app === 'admin') {
    return routePath === '/login' ? 'public' : 'staff';
  }
  return CLIENT_PUBLIC_PATHS.has(routePath) ? 'public' : 'customer';
}

function isRouteGroup(segment: string): boolean {
  return segment.startsWith('(') && segment.endsWith(')');
}

function toToken(segment: string): string | null {
  const match = /^\[(?:\.\.\.)?([^\]]+)\]$/.exec(segment);
  return match ? `{${match[1]}}` : null;
}

function walk(app: AppName, dir: string, segments: string[], out: RouteEntry[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    if (entry.name.startsWith('_') || entry.name === 'api') {
      continue;
    }
    const next = isRouteGroup(entry.name) ? segments : [...segments, entry.name];
    walk(app, path.join(dir, entry.name), next, out);
  }
  if (fs.existsSync(path.join(dir, 'page.tsx'))) {
    const parts = segments.map((segment) => toToken(segment) ?? segment);
    const routePath = `/${parts.join('/')}`;
    out.push({
      app,
      path: routePath === '/' ? '/' : routePath.replace(/\/$/, ''),
      auth: authFor(app, routePath),
      tokens: parts.filter((part) => part.startsWith('{')),
    });
  }
}

/** Marketing content files hold the concrete slugs for the dynamic marketing routes. */
function marketingSlugs(contentFile: string, afterMarker?: string): string[] {
  const full = path.join(REPO_ROOT, 'apps/marketing/src/content', contentFile);
  let source = fs.readFileSync(full, 'utf8');
  if (afterMarker) {
    const at = source.indexOf(afterMarker);
    if (at >= 0) {
      source = source.slice(at);
    }
  }
  return [...source.matchAll(/slug: '([^']+)'/g)].map((match) => match[1]);
}

const MARKETING_TOKEN_SOURCES: Record<string, () => string[]> = {
  '/personal/{product}': () => marketingSlugs('products.ts'),
  '/business/{product}': () => marketingSlugs('products-business.ts'),
  '/wealth/{product}': () => marketingSlugs('products-wealth.ts'),
  '/newsroom/{slug}': () => marketingSlugs('company.ts', 'NEWS_ARTICLES'),
};

function expandMarketing(entries: RouteEntry[]): RouteEntry[] {
  const expanded: RouteEntry[] = [];
  for (const entry of entries) {
    const source = MARKETING_TOKEN_SOURCES[entry.path];
    if (!source) {
      expanded.push(entry);
      continue;
    }
    for (const slug of source()) {
      expanded.push({
        ...entry,
        path: entry.path.replace(/\{[^}]+\}/, slug),
        tokens: [],
      });
    }
  }
  return expanded;
}

export function buildInventory(app: AppName): RouteEntry[] {
  const entries: RouteEntry[] = [];
  walk(app, APP_DIRS[app], [], entries);
  const sorted = entries.sort((a, b) => a.path.localeCompare(b.path));
  return app === 'marketing' ? expandMarketing(sorted) : sorted;
}
