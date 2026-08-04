import { afterAll, beforeAll, describe, it } from 'vitest';

import { notificationsOperations } from '@icb/contracts/openapi/routes/notifications';
import { ContractContext, fillPath, operationOf, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/**
 * Contract suite: notifications (feed, preferences, read receipts).
 *
 * The seed posts no notifications, so the feed page may be empty — the page schema, not the
 * contents, is what is pinned. Both read-receipt mutations drift today: the controllers answer
 * 200 with a body where the route table declares 204 No Content, pinned below with `it.fails`.
 */
describe('contract: notifications', () => {
  let boot: BootResult;
  let app: ContractApp | undefined;
  let ctx: ContractContext;

  beforeAll(async () => {
    boot = await bootContractApp();
    if (boot.available) {
      app = boot.app;
      ctx = new ContractContext(app);
    }
  });

  afterAll(async () => {
    if (app && ctx) {
      ctx.assertCovered(notificationsOperations);
      await closeContractApp(app);
    }
  });

  it('listNotifications — the feed parses as the declared cursor page', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('listNotifications', await ctx.get('/notifications'));
  });

  it('getNotificationPreferences — the resolved matrix parses as declared', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('getNotificationPreferences', await ctx.get('/notifications/preferences'));
  });

  it('updateNotificationPreferences — a partial update returns the resolved matrix', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.put('/notifications/preferences', {
      preferences: [{ event: 'transfer_sent', inApp: true, email: false, sms: false, push: true }],
      quietHours: { enabled: true, from: '22:00', to: '07:00' },
    });
    ctx.expectContract('updateNotificationPreferences', res);
  });

  // KNOWN DRIFT (report to notifications owner): the route table declares 204 No Content for
  // markAllNotificationsRead, but the controller is `@HttpCode(200)` and returns
  // `{ updated: number }`. `it.fails` pins the drift; when either side is fixed this test goes
  // red and must be converted back to `it`.
  it.fails('markAllNotificationsRead [DRIFT: 200 + body vs declared 204]', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('markAllNotificationsRead', await ctx.post('/notifications/read-all', {}));
  });

  // KNOWN DRIFT: same shape as read-all — the controller answers 200 with the notification,
  // the contract declares 204. Skips rather than gaps when the seeded feed is empty: the drift
  // is in the status handling, not in any particular row.
  it.fails('markNotificationRead [DRIFT: 200 + body vs declared 204]', async (t) => {
    requireInfra(t, boot);
    const list = await ctx.get('/notifications');
    const ids = idsFromList(list.body as unknown, 'listNotifications');
    if (ids.length === 0) {
      t.skip('The seed posts no notifications; nothing to mark read.');
    }
    const path = fillPath(operationOf('markNotificationRead').path, {
      notificationId: ids[0] as string,
    });
    ctx.expectContract('markNotificationRead', await ctx.post(path, {}));
  });
});

/** List responses are either a bare array or an `{ items }` envelope; read ids from whichever. */
function idsFromList(body: unknown, operationId: string): string[] {
  const items = Array.isArray(body)
    ? body
    : (body as { items?: unknown[] } | null)?.items;
  if (!Array.isArray(items)) {
    throw new Error(`${operationId} returned neither an array nor an items envelope.`);
  }
  return items.map((item) => (item as { id: string }).id);
}
