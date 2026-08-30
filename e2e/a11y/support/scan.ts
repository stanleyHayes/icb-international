import { expect, test } from 'playwright/test';

import { formatViolation, scanPage, seriousOrCritical } from './axe';
import type { RouteEntry } from './inventory';
import type { AppName } from './paths';
import { materialize, readAvailability, readIds, underA11yConfig } from './state';

/**
 * Declares one axe scan per inventory route. Skips (with a message, never a false fail):
 * not running under the a11y config, app unreachable, dynamic param unresolvable because
 * the collection is empty, route 404s, or the auth session bounced to /login. Genuine
 * serious/critical violations fail.
 */
export function describeRouteScans(app: AppName, entries: readonly RouteEntry[]): void {
  const availability = readAvailability();
  const ids = app === 'marketing' ? {} : readIds(app);

  for (const entry of entries) {
    test(`${entry.path}`, async ({ page }) => {
      test.skip(!underA11yConfig(), 'run via pnpm test:a11y (e2e/a11y/playwright.config.ts)');
      test.skip(
        availability.apps[app] !== true,
        `${app} app not reachable at suite startup; see .auth/availability.json`,
      );
      const resolved = materialize(entry.path, entry.tokens, ids);
      test.skip(resolved === null, `no entity resolves ${entry.path} (empty collection)`);
      if (resolved === null) {
        return;
      }

      const response = await page.goto(resolved, { waitUntil: 'load', timeout: 45_000 });
      test.skip(response?.status() === 404, `${resolved} returned 404 (entity missing)`);
      if (entry.auth !== 'public' && new URL(page.url()).pathname.startsWith('/login')) {
        test.skip(true, `session bounced to /login for ${resolved}; rerun auth setup`);
      }

      const records = await scanPage(page, app, resolved);
      const gated = seriousOrCritical(records);
      expect(gated, gated.map(formatViolation).join('\n')).toEqual([]);
    });
  }
}
