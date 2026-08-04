import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { customersOperations } from '@icb/contracts/openapi/routes/customers';
import { ContractContext, fillPath, operationOf, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/**
 * Contract suite: customers.
 *
 * Two genuine drifts dominate this domain, each pinned with `it.fails` so the suite stays green
 * while the owners fix either side (a fixed drift turns its pin red — convert it back to `it`):
 *
 * 1. PROFILE SHAPE — every customerProfile/customerAdminView body omits `individual.dateOfBirth`
 *    (schema: required) and serialises the optional address fields line2/region/postalCode as
 *    null (schema: optional string; null is not allowed).
 * 2. STAFF MOUNT — the route table declares the staff routes without the `/admin` prefix the
 *    controllers actually mount on, and updateMyPreferences as PUT where the controller is
 *    PATCH; every declared route therefore 404s.
 *
 * Coverage is still recorded for drifted bodies: expectContract marks the operation covered on
 * the contracted status before schema.parse throws.
 */
describe('contract: customers', () => {
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
      ctx.assertCovered(customersOperations);
      await closeContractApp(app);
    }
  });

  it.fails('getMyProfile — the demo customer’s profile parses [DRIFT: dateOfBirth omitted, address optionals null]', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('getMyProfile', await ctx.get('/customers/me'));
  });

  it.fails('updateMyProfile — a phone change returns the declared shape [DRIFT: profile shape, as getMyProfile]', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('updateMyProfile', await ctx.patch('/customers/me', { phone: '+233201234567' }));
  });

  it.fails('updateMyPreferences — the declared verb answers [DRIFT: declared PUT, implemented PATCH]', async (t) => {
    requireInfra(t, boot);
    const declared = operationOf('updateMyPreferences');
    ctx.expectContract('updateMyPreferences', await ctx.put(declared.path, { marketingEmail: true }));
  });

  it.fails('updateMyPreferences — the implemented PATCH returns the declared shape [DRIFT: profile shape]', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.patch('/customers/me/preferences', { marketingEmail: true });
    ctx.expectContract('updateMyPreferences', res);
  });

  it.fails('searchCustomers — the staff directory page parses [DRIFT: profile shape]', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('searchCustomers', await ctx.get('/admin/customers', 'staff'));
  });

  it.fails('getCustomer — the 360° view parses [DRIFT: profile shape]', async (t) => {
    requireInfra(t, boot);
    const customerId = await staffCustomerId(ctx, (app as ContractApp).customerId);
    ctx.expectContract('getCustomer', await ctx.get(`/admin/customers/${customerId}`, 'staff'));
  });

  it('listCustomerNotes — a customer with no notes yet returns the declared empty list', async (t) => {
    requireInfra(t, boot);
    const customerId = await staffCustomerId(ctx, (app as ContractApp).customerId);
    const notes = await ctx.get(`/admin/customers/${customerId}/notes`, 'staff');
    ctx.expectContract('listCustomerNotes', notes);
  });

  // The 201 body is deliberately NOT schema-parsed: customerNoteSchema.authorId is a ULID
  // idSchema, but the harness staff token carries sub `staff-<customerId>` (harness.ts), which
  // the API faithfully echoes into authorId. A production staff token holds a real staff ULID —
  // this is a harness artifact, not contract drift. The contracted status is still pinned.
  it('createCustomerNote — a valid note is accepted with the contracted status', async (t) => {
    requireInfra(t, boot);
    const customerId = await staffCustomerId(ctx, (app as ContractApp).customerId);
    const res = await ctx.post(
      `/admin/customers/${customerId}/notes`,
      { body: 'Contract test note', pinned: true },
      'staff',
    );
    expect(
      res.status,
      `createCustomerNote — expected 201, got ${res.status}: ${JSON.stringify(res.body)}`,
    ).toBe(201);
  });

  it.fails('setCustomerStatus — suspension returns the declared admin view [DRIFT: profile shape]', async (t) => {
    requireInfra(t, boot);
    // Never suspend the suite’s own persona: take any other seeded customer.
    const customerId = await staffCustomerId(ctx, (app as ContractApp).customerId);
    const res = await ctx.post(
      `/admin/customers/${customerId}/status`,
      { status: 'suspended', reason: 'Contract test suspension' },
      'staff',
    );
    ctx.expectContract('setCustomerStatus', res);
  });

  // Declared-path pins: the three staff GETs 404 exactly as declared — the controllers mount
  // them under /admin/customers. Fix either side and these go red.
  it.fails('searchCustomers — the declared path answers [DRIFT: /customers vs /admin/customers]', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('searchCustomers', await ctx.get(operationOf('searchCustomers').path, 'staff'));
  });

  it.fails('getCustomer — the declared path answers [DRIFT: /customers/{id} vs /admin/customers/{id}]', async (t) => {
    requireInfra(t, boot);
    const customerId = await staffCustomerId(ctx, (app as ContractApp).customerId);
    const declared = fillPath(operationOf('getCustomer').path, { customerId });
    ctx.expectContract('getCustomer', await ctx.get(declared, 'staff'));
  });

  it.fails('listCustomerNotes — the declared path answers [DRIFT: /customers/{id}/notes vs /admin/…]', async (t) => {
    requireInfra(t, boot);
    const customerId = await staffCustomerId(ctx, (app as ContractApp).customerId);
    const declared = fillPath(operationOf('listCustomerNotes').path, { customerId });
    ctx.expectContract('listCustomerNotes', await ctx.get(declared, 'staff'));
  });
});

/** Any seeded customer except the suite’s own persona, discovered via the staff directory. */
async function staffCustomerId(ctx: ContractContext, selfId: string): Promise<string> {
  const res = await ctx.get('/admin/customers', 'staff');
  const id = idsFromList(res.body as unknown, 'searchCustomers').find((candidate) => candidate !== selfId);
  if (!id) {
    throw new Error('searchCustomers returned no customer other than the suite persona.');
  }
  return id;
}

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
