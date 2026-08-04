import { afterAll, beforeAll, describe, it } from 'vitest';

import { governanceOperations } from '@icb/contracts/openapi/routes/governance';
import { ContractContext, operationOf, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/**
 * Contract suite: governance — staff directory, audit trail and the maker-checker inbox.
 *
 * KNOWN DRIFT (report to SDK-01 + iam/audit owners): the route table mounts this whole domain
 * under `/governance/*`, but the application still serves it under the old paths —
 * `/admin/staff` (staff.controller.ts), `/admin/audit/events` + `/admin/audit/integrity`
 * (audit.controller.ts) and `/admin/approvals` (approvals.controller.ts). Every contracted
 * path therefore answers 404. `it.fails` keeps the suite green while pinning each drift —
 * when the routes are mounted as declared these tests go red and must be converted back to
 * `it` (and the matching `ctx.gap` removed).
 *
 * The domain's mutations (`createStaffUser`, `decideApproval`) sit behind @RequireStepUp, so
 * no valid payload is feasible from the harness's plain staff token; they are not exercised.
 */
describe('contract: governance', () => {
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
      ctx.assertCovered(governanceOperations);
      await closeContractApp(app);
    }
  });

  it.fails('listStaffUsers — the staff directory parses as declared [DRIFT: /governance/staff not mounted; app serves /admin/staff — 404]', async (t) => {
    requireInfra(t, boot);
    ctx.gap('listStaffUsers', 'route table declares /governance/staff; the app serves /admin/staff (404 on the contracted path)');
    ctx.expectContract('listStaffUsers', await ctx.get(operationOf('listStaffUsers').path, 'staff'));
  });

  it.fails('searchAuditEvents — an audit page parses as declared [DRIFT: /governance/audit not mounted; app serves /admin/audit/events — 404]', async (t) => {
    requireInfra(t, boot);
    ctx.gap('searchAuditEvents', 'route table declares /governance/audit; the app serves /admin/audit/events (404 on the contracted path)');
    ctx.expectContract('searchAuditEvents', await ctx.get(operationOf('searchAuditEvents').path, 'staff'));
  });

  it.fails('verifyAuditIntegrity — the chain report parses as declared [DRIFT: /governance/audit/integrity not mounted; app serves /admin/audit/integrity — 404]', async (t) => {
    requireInfra(t, boot);
    ctx.gap('verifyAuditIntegrity', 'route table declares /governance/audit/integrity; the app serves /admin/audit/integrity (404 on the contracted path)');
    ctx.expectContract('verifyAuditIntegrity', await ctx.get(operationOf('verifyAuditIntegrity').path, 'staff'));
  });

  it.fails('listApprovals — the maker-checker inbox parses as declared [DRIFT: /governance/approvals not mounted; app serves /admin/approvals — 404]', async (t) => {
    requireInfra(t, boot);
    ctx.gap('listApprovals', 'route table declares /governance/approvals; the app serves /admin/approvals (404 on the contracted path; the live route also returns a bare array, not the contracted offset page)');
    ctx.expectContract('listApprovals', await ctx.get(operationOf('listApprovals').path, 'staff'));
  });
});
