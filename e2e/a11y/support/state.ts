import fs from 'node:fs';

import { AVAILABILITY_FILE, IDS_FILE } from './paths';

/** Sync readers for the files global-setup writes; specs call these at load time. */

export interface Availability {
  api: boolean;
  mongo: boolean;
  apps: Record<string, boolean>;
  adminTotp: boolean;
  notes: string[];
}

export function readAvailability(): Availability {
  try {
    return JSON.parse(fs.readFileSync(AVAILABILITY_FILE, 'utf8')) as Availability;
  } catch {
    return { api: false, mongo: false, apps: {}, adminTotp: false, notes: ['no setup output'] };
  }
}

/** True only in workers spawned by e2e/a11y/playwright.config.ts (it sets the marker). */
export function underA11yConfig(): boolean {
  return process.env['A11Y_SUITE'] === '1';
}

export function readIds(app: 'client' | 'admin'): Record<string, string | null> {
  try {
    const ids = JSON.parse(fs.readFileSync(IDS_FILE, 'utf8')) as Record<
      string,
      Record<string, string | null>
    >;
    return ids[app] ?? {};
  } catch {
    return {};
  }
}

/** Fill a route template's `{token}` from resolved ids; null when any param is missing. */
export function materialize(
  routePath: string,
  tokens: readonly string[],
  ids: Record<string, string | null>,
): string | null {
  if (tokens.length === 0) {
    return routePath;
  }
  const resolved = ids[routePath];
  if (!resolved) {
    return null;
  }
  let path = routePath;
  for (const token of tokens) {
    path = path.replace(token, resolved);
  }
  return path;
}
