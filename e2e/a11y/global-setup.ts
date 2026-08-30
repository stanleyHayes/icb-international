import fs from 'node:fs';

import { apiLogin } from './support/api';
import { AUTH_DIR, AVAILABILITY_FILE, BASE_URLS, IDS_FILE } from './support/paths';
import { CUSTOMER } from './support/credentials';
import { resolveAdminIds, resolveClientIds } from './support/resolve';

/**
 * Playwright global setup: probe infra, resolve dynamic-route ids.
 *
 * Everything is best-effort. Missing infra is recorded in .auth/availability.json and the
 * specs skip with a message instead of false-failing. Writes:
 *   .auth/availability.json  — what is reachable
 *   .auth/dynamic-ids.json   — { client, admin } route-param resolution
 */

interface Availability {
  api: boolean;
  mongo: boolean;
  apps: Record<string, boolean>;
  notes: string[];
}

async function probe(url: string): Promise<boolean> {
  // Any HTTP response at all — redirects, 404s, 405s — proves the server is up. Retry to
  // ride out dev-server compile stalls and mid-restart windows.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      return response.status > 0;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
  return false;
}

export default async function globalSetup(): Promise<void> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });
  const availability: Availability = {
    api: false,
    mongo: false,
    apps: {},
    notes: [],
  };

  availability.api = await probeHealth();
  for (const [app, url] of Object.entries(BASE_URLS)) {
    availability.apps[app] = await probe(url);
    if (!availability.apps[app]) {
      availability.notes.push(`${app} app not reachable at ${url}; its scans will be skipped.`);
    }
  }

  const ids: { client: Record<string, string | null>; admin: Record<string, string | null> } = {
    client: {},
    admin: {},
  };

  if (availability.api) {
    try {
      const login = await apiLogin(CUSTOMER.email, CUSTOMER.password);
      ids.client = await resolveClientIds(login.accessToken);
    } catch (error) {
      availability.notes.push(`API reachable but setup failed: ${String(error)}`);
    }
  } else {
    availability.notes.push('API not reachable; authenticated scans will be skipped.');
  }

  try {
    ids.admin = await resolveAdminIds();
    availability.mongo = true;
  } catch {
    availability.notes.push('Mongo not reachable; admin dynamic routes will be skipped.');
  }

  fs.writeFileSync(AVAILABILITY_FILE, JSON.stringify(availability, null, 2));
  fs.writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2));

  for (const note of availability.notes) {
    console.warn(`[a11y setup] ${note}`);
  }
}

async function probeHealth(): Promise<boolean> {
  // POST-only route: a 404/405 problem+json still proves Nest is up; GET avoids OPTIONS
  // handlers entirely.
  return probe(`${process.env['A11Y_API_URL'] ?? 'http://localhost:4100/v1'}/auth/login`);
}
