import { expect, test as base, type Page } from 'playwright/test';

import { ApiClient, apiReachable } from './api';
import { mongoReachable } from './db';
import { env, seedUsers } from './env';

/**
 * Shared fixtures.
 *
 * `stack` is the preflight every spec opts into: it checks the API, the client app and Mongo
 * once per test and skips with an explicit, greppable message when a piece is genuinely down —
 * never a false failure, never a silent pass. It also verifies the seed is loaded by logging
 * in as the demo persona, because every journey assumes the seeded bank exists.
 */

export interface StackFixtures {
  stack: void;
  customerApi: ApiClient;
  staffApi: (email: string, password: string) => Promise<ApiClient>;
}

async function urlAnswers(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
    return response.status < 500;
  } catch {
    return false;
  }
}

export const test = base.extend<StackFixtures>({
  stack: [
    async ({}, use) => {
      if (!(await apiReachable())) {
        test.skip(
          true,
          `E2E stack unavailable: API not answering at ${env.apiUrl}/health ` +
            '(boot with `pnpm --filter @icb/api dev`, Mongo replica set required)',
        );
      }
      if (!(await urlAnswers(`${env.clientUrl}/login`))) {
        test.skip(
          true,
          `E2E stack unavailable: client app not answering at ${env.clientUrl} ` +
            '(boot with `pnpm --filter @icb/client dev`)',
        );
      }
      if (!(await mongoReachable())) {
        test.skip(true, 'E2E stack unavailable: MongoDB not reachable (see .env MONGO_URI)');
      }
      try {
        const probe = await ApiClient.login(seedUsers.demo.email, seedUsers.demo.password);
        await probe.dispose();
      } catch (cause) {
        test.skip(true, `E2E stack not seeded (run \`pnpm seed\`): ${(cause as Error).message}`);
      }
      await use();
    },
    { auto: true },
  ],

  customerApi: async ({}, use) => {
    const client = await ApiClient.login(seedUsers.demo.email, seedUsers.demo.password);
    await use(client);
    await client.dispose();
  },

  staffApi: async ({}, use) => {
    const opened: ApiClient[] = [];
    await use(async (email, password) => {
      const client = await ApiClient.login(email, password);
      opened.push(client);
      return client;
    });
    await Promise.all(opened.map((client) => client.dispose()));
  },
});

export { expect };

/** UI login through the real form — the sealed cookie only ever comes from the server. */
export async function loginViaUi(page: Page, email: string, password: string): Promise<void> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt > 0) {
      await page.waitForTimeout(2_000);
    }
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/^Password/).fill(password);
    await page.getByRole('button', { name: /sign in/i }).click();
    try {
      await page.waitForURL(
        (url) => url.pathname !== '/login' && !url.pathname.startsWith('/login/'),
        { timeout: 60_000, waitUntil: 'commit' },
      );
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
