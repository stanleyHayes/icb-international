import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { newId } from '../../src/infrastructure/database/identifier.js';
import { bootSecurityApp, SKIP_MESSAGE, type SecurityTestApp } from './harness/app-harness.js';
import { seedCustomer, staffIdentity, type TestIdentity } from './harness/identities.js';

type Method = 'get' | 'post' | 'patch' | 'delete';

/** One staff-only route per row. Ids are well-formed but nonexistent: role checks come first. */
interface StaffRoute {
  readonly area: string;
  readonly method: Method;
  readonly path: string;
}

const id = newId();
const STAFF_ROUTES: readonly StaffRoute[] = [
  { area: 'admin', method: 'get', path: '/v1/admin/kpis' },
  { area: 'admin', method: 'get', path: '/v1/admin/trial-balance' },
  { area: 'admin', method: 'get', path: '/v1/admin/monitor' },
  { area: 'admin', method: 'get', path: '/v1/admin/ledger-integrity' },
  { area: 'admin', method: 'get', path: '/v1/admin/customers' },
  { area: 'admin', method: 'get', path: `/v1/admin/customers/${id}` },
  { area: 'admin', method: 'post', path: '/v1/admin/postings' },
  { area: 'admin', method: 'get', path: '/v1/admin/health' },
  { area: 'admin-accounts', method: 'post', path: `/v1/admin/accounts/${id}/status` },
  { area: 'admin-accounts', method: 'post', path: `/v1/admin/accounts/${id}/overdraft` },
  { area: 'cards-staff', method: 'get', path: '/v1/admin/cards' },
  { area: 'cards-staff', method: 'post', path: '/v1/admin/cards' },
  { area: 'cards-staff', method: 'get', path: `/v1/admin/cards/${id}` },
  { area: 'cards-staff', method: 'post', path: `/v1/admin/cards/${id}/block` },
  { area: 'cards-staff', method: 'post', path: `/v1/admin/cards/${id}/reissue` },
  { area: 'cards-staff', method: 'post', path: `/v1/admin/cards/${id}/pin-reset` },
  { area: 'cards-staff', method: 'patch', path: `/v1/admin/cards/${id}/limits` },
  { area: 'cards-staff', method: 'get', path: `/v1/admin/cards/${id}/authorisations` },
  { area: 'card-network', method: 'post', path: `/v1/cards/${id}/authorise` },
  { area: 'card-network', method: 'post', path: `/v1/cards/authorisations/${id}/capture` },
  { area: 'card-network', method: 'post', path: `/v1/cards/authorisations/${id}/reverse` },
  { area: 'card-network', method: 'post', path: '/v1/cards/authorisations/expire' },
  { area: 'loans-admin', method: 'get', path: '/v1/loans/admin/queue' },
  { area: 'loans-admin', method: 'post', path: `/v1/loans/admin/applications/${id}/decision` },
  { area: 'loans-admin', method: 'post', path: `/v1/loans/admin/${id}/disburse` },
  { area: 'disputes-admin', method: 'get', path: '/v1/disputes/admin/queue' },
  { area: 'disputes-admin', method: 'get', path: `/v1/disputes/admin/${id}` },
  { area: 'disputes-admin', method: 'post', path: `/v1/disputes/${id}/advance` },
  { area: 'support-staff', method: 'get', path: '/v1/support/staff/inbox' },
  { area: 'support-staff', method: 'get', path: `/v1/support/staff/tickets/${id}` },
  { area: 'support-staff', method: 'post', path: `/v1/support/staff/tickets/${id}/messages` },
  { area: 'support-staff', method: 'post', path: `/v1/support/staff/tickets/${id}/assign` },
  { area: 'support-staff', method: 'patch', path: `/v1/support/staff/tickets/${id}` },
  { area: 'support-staff', method: 'get', path: '/v1/support/staff/macros' },
  { area: 'support-staff', method: 'post', path: '/v1/support/staff/macros' },
  { area: 'support-staff', method: 'delete', path: `/v1/support/staff/macros/${id}` },
  { area: 'iam', method: 'get', path: '/v1/admin/staff' },
  { area: 'iam', method: 'post', path: `/v1/admin/approvals/${id}/decision` },
  { area: 'audit', method: 'get', path: '/v1/admin/audit/events' },
  { area: 'audit', method: 'get', path: '/v1/admin/audit/integrity' },
];

/** Denied is 403 (role/permission) or 401 (unauthenticated); 2xx is the only failure. */
const DENIED = [401, 403];

describe('SEC-02 privilege escalation — staff surface vs non-staff principals', () => {
  let handle: SecurityTestApp | null = null;
  let customer: TestIdentity;
  let noRole: TestIdentity;
  let support: TestIdentity;

  beforeAll(async () => {
    handle = await bootSecurityApp('privesc');
    if (!handle) {
      return;
    }
    customer = await seedCustomer(handle.connection, { email: 'customer@privesc.sec02.test', firstName: 'Mallory', lastName: 'Customer' });
    noRole = staffIdentity([], 'norole');
    support = staffIdentity(['support'], 'support');
  }, 300_000);

  afterAll(async () => {
    await handle?.close();
  });

  /** Narrow the booted handle or skip-with-message — never a false failure on absent infra. */
  function requireApp(context: { skip: (note?: string) => void }): SecurityTestApp {
    if (!handle) {
      context.skip(SKIP_MESSAGE);
      throw new Error(SKIP_MESSAGE);
    }
    return handle;
  }

  function call(handleApp: SecurityTestApp, method: Method, path: string, token: string | null) {
    const server = handleApp.app.getHttpServer();
    const test = request(server)[method](path);
    return token ? test.set('Authorization', `Bearer ${token}`) : test;
  }

  /** Empty JSON body on mutations only: Fastify 400s a bodied GET before any guard runs. */
  function fire(handleApp: SecurityTestApp, route: StaffRoute, token: string | null) {
    const test = call(handleApp, route.method, route.path, token);
    return route.method === 'get' ? test : test.send({});
  }

  for (const route of STAFF_ROUTES) {
    it(`customer token denied on ${route.area}: ${route.method.toUpperCase()} ${route.path}`, async (context) => {
      const h = requireApp(context);
      const response = await fire(h, route, customer.accessToken);
      expect(DENIED, `customer reached ${route.path}: ${response.status}`).toContain(response.status);
    });

    it(`staff-without-roles denied on ${route.area}: ${route.method.toUpperCase()} ${route.path}`, async (context) => {
      const h = requireApp(context);
      const response = await fire(h, route, noRole.accessToken);
      expect(DENIED, `role-less staff reached ${route.path}: ${response.status}`).toContain(response.status);
    });
  }

  it('unauthenticated request is rejected before any role check', async (context) => {
    const h = requireApp(context);
    const response = await call(h, 'get', '/v1/admin/kpis', null);
    expect(response.status).toBe(401);
  });

  it('customer denial carries the PERMISSION_DENIED problem code, not a generic error', async (context) => {
    const h = requireApp(context);
    const response = await call(h, 'get', '/v1/admin/kpis', customer.accessToken);
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ code: 'PERMISSION_DENIED' });
  });

  it('support role denied where underwriter/operations roles are required', async (context) => {
    const h = requireApp(context);
    for (const path of ['/v1/loans/admin/queue', '/v1/admin/postings', `/v1/admin/cards/${id}/block`, `/v1/cards/${id}/authorise`]) {
      const route: StaffRoute = { area: 'support-scope', method: path.includes('queue') ? 'get' : 'post', path };
      const response = await fire(h, route, support.accessToken);
      expect(DENIED, `support role reached ${path}: ${response.status}`).toContain(response.status);
    }
  });

  it('control: support role reaches its own surface (guards are not blanket-denying)', async (context) => {
    const h = requireApp(context);
    const inbox = await call(h, 'get', '/v1/support/staff/inbox', support.accessToken);
    expect(inbox.status).toBe(200);
    const customers = await call(h, 'get', '/v1/admin/customers', support.accessToken);
    expect(customers.status).toBe(200);
  });
});
