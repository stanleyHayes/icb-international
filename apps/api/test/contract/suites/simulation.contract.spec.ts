import { afterAll, beforeAll, describe, it } from 'vitest';

import { simulationOperations } from '@icb/contracts/openapi/routes/simulation';
import { ContractContext, fillPath, operationOf, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/** Scenario runs and the end-of-day pipeline do real work; give them room. */
const SLOW_MS = 120_000;

/**
 * Contract suite: simulation — the control room (state, clock, rails, scenarios, end of day,
 * ledger integrity, feature flags). Everything is `super_admin`, so every call goes out as staff.
 *
 * Three list endpoints declare a bare array in the route table but answer with the standard
 * `{ items: [...] }` envelope, and the POST commands declare 200/202 while Nest answers 201 —
 * each is pinned with `it.fails` so the suite stays green without hiding the drift.
 */
describe('contract: simulation', () => {
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
      ctx.assertCovered(simulationOperations);
      await closeContractApp(app);
    }
  });

  it('getSimulationState / getClock — the control-room snapshot parses as declared', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('getSimulationState', await ctx.get('/simulation/state', 'staff'));
    ctx.expectContract('getClock', await ctx.get('/simulation/clock', 'staff'));
  });

  // KNOWN DRIFT (report to SDK-01 + simulation owner): the route table declares a bare
  // `z.array(railProfileSchema)`, but the controller returns the `{ items: [...] }` envelope.
  it.fails('listRailProfiles — the rail profiles parse as declared [DRIFT: envelope vs array]', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('listRailProfiles', await ctx.get('/simulation/rails', 'staff'));
  });

  it('updateRailProfile — re-sending a rail’s own failure rate returns the declared profile', async (t) => {
    requireInfra(t, boot);
    const list = await ctx.get('/simulation/rails', 'staff');
    const profile = (list.body as { items: { rail: string; failureRate: number }[] }).items[0];
    if (!profile) {
      throw new Error('listRailProfiles returned no rails to re-send.');
    }

    const res = await ctx.patch(
      fillPath(operationOf('updateRailProfile').path, { rail: profile.rail }),
      { failureRate: profile.failureRate },
      'staff',
    );
    ctx.expectContract('updateRailProfile', res);
  });

  // KNOWN DRIFT: route table declares a bare `z.array(scenarioSchema)`, controller returns
  // the `{ items: [...] }` envelope.
  it.fails('listScenarios — the catalogue parses as declared [DRIFT: envelope vs array]', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('listScenarios', await ctx.get('/simulation/scenarios', 'staff'));
  });

  // KNOWN DRIFT: the route table declares 202 for runScenario, but the controller is a Nest
  // `@Post` without `@HttpCode`, so it answers 201. The run id still comes off the response
  // body, so getScenarioRun is covered inside the same test before the status assertion throws.
  it.fails('runScenario / getScenarioRun — a run starts and reads back [DRIFT: 201 vs declared 202]', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.post(
      '/simulation/scenarios/run',
      { name: 'payday', seed: 'contract-suite', intensity: 'light' },
      'staff',
    );
    const runId = (res.body as { id: string }).id;
    const runPath = fillPath(operationOf('getScenarioRun').path, { runId });
    ctx.expectContract('getScenarioRun', await ctx.get(runPath, 'staff'));
    ctx.expectContract('runScenario', res);
  }, SLOW_MS);

  it('checkLedgerIntegrity — the books balance after seeding', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract(
      'checkLedgerIntegrity',
      await ctx.get('/simulation/ledger/integrity', 'staff'),
    );
  });

  // KNOWN DRIFT (report to simulation/EOD owner): the route table declares 200 for
  // runEndOfDay, but the pipeline 500s on seeded data — AmlMonitoringStep.raise inserts
  // alerts with `reference: null` and the second insert hits the unique reference index
  // (E11000). Pinned with `it.fails`; a fix on either side turns this red.
  it.fails('runEndOfDay — the pipeline runs on demand [DRIFT: 500 — EOD AML step duplicate reference:null]', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('runEndOfDay', await ctx.post('/simulation/end-of-day', {}, 'staff'));
  }, SLOW_MS);

  // KNOWN DRIFT: route table declares a bare `z.array(featureFlagSchema)`, controller returns
  // the `{ items: [...] }` envelope.
  it.fails('listFeatureFlags — the flags parse as declared [DRIFT: envelope vs array]', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('listFeatureFlags', await ctx.get('/simulation/feature-flags', 'staff'));
  });

  it('updateFeatureFlag — re-sending a flag’s own state returns the declared flag', async (t) => {
    requireInfra(t, boot);
    const list = await ctx.get('/simulation/feature-flags', 'staff');
    const flag = (list.body as { items: { key: string; enabled: boolean }[] }).items[0];
    if (!flag) {
      throw new Error('listFeatureFlags returned no flags to re-send.');
    }

    const res = await ctx.patch(
      fillPath(operationOf('updateFeatureFlag').path, { key: flag.key }),
      { enabled: flag.enabled },
      'staff',
    );
    ctx.expectContract('updateFeatureFlag', res);
  });

  // Clock mutations run last so no earlier assertion observes an offset clock. Both are KNOWN
  // DRIFT: the route table declares 200, the controllers answer 201 (Nest POST).
  it.fails('advanceClock — a one-hour jump returns the clock [DRIFT: 201 vs declared 200]', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.post(
      '/simulation/clock/advance',
      { duration: 'PT1H', runEndOfDay: false },
      'staff',
    );
    ctx.expectContract('advanceClock', res);
  });

  it('setClock — freezing the clock returns the declared clock state', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('setClock', await ctx.put('/simulation/clock', { frozen: true }, 'staff'));
  });

  it.fails('resetClock — back to real time [DRIFT: 201 vs declared 200]', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('resetClock', await ctx.post('/simulation/clock/reset', {}, 'staff'));
  });
});
