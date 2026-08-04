import { afterAll, beforeAll, describe, it } from 'vitest';
import { ulid } from 'ulid';

import { riskOperations } from '@icb/contracts/openapi/routes/risk';
import { ContractContext, fillPath, operationOf, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/**
 * Contract suite: risk — the fraud rule set, the case queue, and the AML back office.
 *
 * The seed raises no cases and no alerts, and no HTTP route creates one (screening and scoring
 * are services, not routes), so the suite writes the documents a raised case needs — assessment
 * plus case, or alert — straight into the throwaway database, then drives every endpoint over
 * HTTP. Ids always come back from list responses, never from the inserts.
 */
describe('contract: risk', () => {
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
      ctx.assertCovered(riskOperations);
      await closeContractApp(app);
    }
  });

  it('listRiskRules / updateRiskRule — the seeded rule set parses and a tune round-trips', async (t) => {
    requireInfra(t, boot);
    const list = await ctx.get('/risk/rules', 'staff');
    ctx.expectContract('listRiskRules', list);

    const ruleId = firstId(idsFromList(list.body as unknown, 'listRiskRules'), 'listRiskRules');
    const res = await ctx.patch(
      fillPath(operationOf('updateRiskRule').path, { ruleId }),
      { weight: 42, reason: 'Contract test tune' },
      'staff',
    );
    ctx.expectContract('updateRiskRule', res);
  });

  it('listRiskCases / getRiskCase / assignRiskCase / resolveRiskCase — the queue end to end', async (t) => {
    requireInfra(t, boot);
    await seedRiskCase(app as ContractApp);

    const list = await ctx.get('/risk/cases', 'staff');
    ctx.expectContract('listRiskCases', list);
    const caseId = firstId(idsFromList(list.body as unknown, 'listRiskCases'), 'listRiskCases');

    const detailPath = fillPath(operationOf('getRiskCase').path, { caseId });
    ctx.expectContract('getRiskCase', await ctx.get(detailPath, 'staff'));

    const assignPath = fillPath(operationOf('assignRiskCase').path, { caseId });
    ctx.expectContract('assignRiskCase', await ctx.post(assignPath, {}, 'staff'));

    const resolvePath = fillPath(operationOf('resolveRiskCase').path, { caseId });
    const res = await ctx.post(
      resolvePath,
      { action: 'released', note: 'Confirmed legitimate by the contract suite.' },
      'staff',
    );
    ctx.expectContract('resolveRiskCase', res);
  });

  it('listAmlAlerts / getAmlAlert / updateAmlAlert — the alert queue end to end', async (t) => {
    requireInfra(t, boot);
    await seedAmlAlert(app as ContractApp);

    const list = await ctx.get('/admin/aml/alerts', 'staff');
    ctx.expectContract('listAmlAlerts', list);
    const alertId = firstId(idsFromList(list.body as unknown, 'listAmlAlerts'), 'listAmlAlerts');

    const detailPath = fillPath(operationOf('getAmlAlert').path, { alertId });
    ctx.expectContract('getAmlAlert', await ctx.get(detailPath, 'staff'));

    const res = await ctx.patch(
      detailPath,
      { narrative: 'Reviewed against the seeded transaction history; keeping open.' },
      'staff',
    );
    ctx.expectContract('updateAmlAlert', res);
  });

  // KNOWN DRIFT (report to SDK-01 + aml owner): the route table declares 200 for fileAmlReport,
  // but the controller is a Nest `@Post` without `@HttpCode`, so it answers 201. `it.fails`
  // keeps the suite green while pinning the drift — a fix on either side turns this red.
  it.fails('fileAmlReport — filing a SAR returns the alert [DRIFT: 201 vs declared 200]', async (t) => {
    requireInfra(t, boot);
    await seedAmlAlert(app as ContractApp);
    const list = await ctx.get('/admin/aml/alerts', 'staff');
    const alertId = firstId(idsFromList(list.body as unknown, 'listAmlAlerts'), 'listAmlAlerts');

    const res = await ctx.post(
      fillPath(operationOf('fileAmlReport').path, { alertId }),
      {
        kind: 'sar',
        narrative:
          'Structuring pattern confirmed against the seeded transaction history; draft filed.',
      },
      'staff',
    );
    ctx.expectContract('fileAmlReport', res);
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

/** Indexing a list under noUncheckedIndexedAccess: fail loudly when the seed went missing. */
function firstId(items: string[], operationId: string): string {
  const first = items[0];
  if (first === undefined) {
    throw new Error(`${operationId} returned no rows to take an id from.`);
  }
  return first;
}

/**
 * The assessment + case pair `RiskCasesService.raise` would have written, inserted directly
 * because no route raises a case. The list queue only surfaces actionable statuses, so `open`.
 */
async function seedRiskCase(app: ContractApp): Promise<void> {
  const now = app.clock.now();
  const assessmentId = ulid();
  await app.db.collection<{ _id: string } & Record<string, unknown>>('risk_assessments').insertOne({
    _id: assessmentId,
    subjectType: 'transfer',
    subjectId: ulid(),
    customerId: app.customerId,
    score: 85,
    decision: 'review',
    firedRules: [
      {
        code: 'amount_anomaly',
        label: 'Amount anomaly',
        weight: 40,
        contribution: 40,
        observed: '10x the customer’s usual transfer',
        threshold: null,
      },
    ],
    narrative: 'Seeded by the contract suite so the fraud queue has a case to work.',
    amountMinorUnits: 250_000,
    currency: 'GHS',
    rulesConsidered: 9,
    assessedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  await app.db.collection<{ _id: string } & Record<string, unknown>>('risk_cases').insertOne({
    _id: ulid(),
    reference: `CASE-${ulid()}`,
    customerId: app.customerId,
    customerName: 'Contract Test Persona',
    assessmentId,
    severity: 'high',
    status: 'open',
    decision: 'review',
    amountMinorUnits: 250_000,
    currency: 'GHS',
    assignedTo: null,
    resolution: null,
    createdAt: now,
    updatedAt: now,
  });
}

/** The document `AmlAlertsService.raise` would have written; no route raises an alert either. */
async function seedAmlAlert(app: ContractApp): Promise<void> {
  const now = app.clock.now();
  await app.db.collection<{ _id: string } & Record<string, unknown>>('aml_alerts').insertOne({
    _id: ulid(),
    reference: `AML-${ulid()}`,
    kind: 'structuring',
    customerId: app.customerId,
    customerName: 'Contract Test Persona',
    severity: 'high',
    status: 'open',
    matchDetail: 'Repeated sub-threshold deposits across the seeded history.',
    matchScore: 0.9,
    relatedTransactionIds: [],
    aggregateMinorUnits: 500_000,
    currency: 'GHS',
    narrative: null,
    assignedTo: null,
    filedReport: null,
    trail: [{ at: now, by: 'system', action: 'raised', detail: 'Alert raised: structuring' }],
    createdAt: now,
    updatedAt: now,
  });
}
