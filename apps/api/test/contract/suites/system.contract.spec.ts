import request from 'supertest';
import { afterAll, beforeAll, describe, it } from 'vitest';

import { systemOperations } from '@icb/contracts/openapi/routes/system';
import { ContractContext, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/**
 * Contract suite: system — the liveness and readiness probes.
 *
 * The probes are excluded from the `/v1` global prefix (a load balancer does not version its
 * health checks), so these are the only contract tests that bypass `ctx.get` and call supertest
 * directly; `ctx.expectContract` still pins status and schema. Both are `@Public`, so no token.
 */
describe('contract: system', () => {
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
      ctx.assertCovered(systemOperations);
      await closeContractApp(app);
    }
  });

  it('healthCheck — liveness parses as declared', async (t) => {
    requireInfra(t, boot);
    const res = await request(serverOf(app as ContractApp)).get('/health');
    ctx.expectContract('healthCheck', res);
  });

  it('readinessCheck — readiness parses as declared', async (t) => {
    requireInfra(t, boot);
    const res = await request(serverOf(app as ContractApp)).get('/health/ready');
    ctx.expectContract('readinessCheck', res);
  });
});

/** The bound HTTP server, reached without the `/v1` prefix the probes are excluded from. */
function serverOf(app: ContractApp): never {
  return app.app.getHttpAdapter().getInstance().server as never;
}
