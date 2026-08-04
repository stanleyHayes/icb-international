import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { FaqArticleView, RateEntryView, TemplateOverrideView } from '@icb/contracts';
import { contentOperations } from '@icb/contracts/openapi/routes/content';
import { ContractContext, fillPath, operationOf, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/**
 * Contract suite: content — the public marketing surface (`/content/*`, anonymous) and the
 * staff CMS (`/admin/content/*`).
 *
 * Nothing in this domain is seeded, so every read is fed by a staff write the suite makes
 * itself; the public GETs then prove only published articles and active locations leak out.
 * The rate entry's `effectiveFrom` is taken from the layered table the API already serves —
 * the bank's own clock, never a hard-coded date. All three public endpoints are `@Public`,
 * so they are called with no token, exactly as the marketing site calls them.
 */
describe('contract: content', () => {
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
      ctx.assertCovered(contentOperations);
      await closeContractApp(app);
    }
  });

  it('FAQ lifecycle — create, list, update, publish, delete', async (t) => {
    requireInfra(t, boot);
    const created = await ctx.post('/admin/content/faq', {
      title: 'Contract test article',
      category: 'contract-testing',
      body: 'A draft the public surface must not show.',
      published: false,
    }, 'staff');
    const draft = ctx.expectContract('createFaqArticle', created) as FaqArticleView;

    ctx.expectContract('listFaqArticles', await ctx.get('/admin/content/faq', 'staff'));

    const updatePath = fillPath(operationOf('updateFaqArticle').path, { articleId: draft.id });
    ctx.expectContract('updateFaqArticle', await ctx.patch(updatePath, { published: true }, 'staff'));

    const published = await ctx.get('/content/faq?category=contract-testing', 'none');
    const articles = ctx.expectContract('listPublishedFaq', published) as FaqArticleView[];
    expect(articles.map((a) => a.id)).toContain(draft.id);

    const deletePath = fillPath(operationOf('deleteFaqArticle').path, { articleId: draft.id });
    ctx.expectContract('deleteFaqArticle', await ctx.delete(deletePath, 'staff'));
  });

  it('location lifecycle — create, list, update, deactivate, delete', async (t) => {
    requireInfra(t, boot);
    const created = await ctx.post('/admin/content/locations', {
      name: 'Contract Test Branch',
      type: 'branch',
      address: { line1: '1 Test Way', city: 'Accra', country: 'GH' },
      services: ['counter'],
    }, 'staff');
    const branch = ctx.expectContract('createContentLocation', created) as { id: string };

    ctx.expectContract('listContentLocations', await ctx.get('/admin/content/locations', 'staff'));

    const active = await ctx.get('/content/locations', 'none');
    const locations = ctx.expectContract('listActiveLocations', active) as { id: string }[];
    expect(locations.map((l) => l.id)).toContain(branch.id);

    const updatePath = fillPath(operationOf('updateContentLocation').path, {
      locationId: branch.id,
    });
    ctx.expectContract('updateContentLocation', await ctx.patch(updatePath, { active: false }, 'staff'));

    // An inactive branch must drop off the public surface.
    const after = ctx.expectContract('listActiveLocations', await ctx.get('/content/locations', 'none')) as { id: string }[];
    expect(after.map((l) => l.id)).not.toContain(branch.id);

    const deletePath = fillPath(operationOf('deleteContentLocation').path, {
      locationId: branch.id,
    });
    ctx.expectContract('deleteContentLocation', await ctx.delete(deletePath, 'staff'));
  });

  it('template lifecycle — upsert, preview, list, delete', async (t) => {
    requireInfra(t, boot);
    const copy = {
      key: 'contract_test_notice',
      channel: 'email',
      subject: 'Contract test subject',
      body: 'Hello from the contract suite.',
    };
    const upserted = await ctx.post('/admin/content/templates', copy, 'staff');
    const override = ctx.expectContract('upsertTemplateOverride', upserted) as TemplateOverrideView;

    ctx.expectContract('previewTemplate', await ctx.post('/admin/content/templates/preview', copy, 'staff'));
    ctx.expectContract('listTemplateOverrides', await ctx.get('/admin/content/templates', 'staff'));

    const deletePath = fillPath(operationOf('deleteTemplateOverride').path, {
      templateId: override.id,
    });
    ctx.expectContract('deleteTemplateOverride', await ctx.delete(deletePath, 'staff'));
  });

  it('rate entry lifecycle — upsert layers over the public table, delete', async (t) => {
    requireInfra(t, boot);
    // The layered table doubles as the bank clock source for the entry's effective date.
    const before = ctx.expectContract('getLayeredRateTable', await ctx.get('/content/rates', 'none')) as {
      effectiveFrom: string;
    };

    const upserted = await ctx.post('/admin/content/rates', {
      productCode: 'icb-contract-test',
      name: 'Contract Test Savings',
      rate: 4.25,
      effectiveFrom: before.effectiveFrom,
    }, 'staff');
    const entry = ctx.expectContract('upsertRateEntry', upserted) as RateEntryView;

    ctx.expectContract('listRateEntries', await ctx.get('/admin/content/rates', 'staff'));

    const layered = ctx.expectContract('getLayeredRateTable', await ctx.get('/content/rates', 'none')) as {
      savings: { productCode: string }[];
    };
    expect(layered.savings.map((s) => s.productCode)).toContain('icb-contract-test');

    const deletePath = fillPath(operationOf('deleteRateEntry').path, { entryId: entry.id });
    ctx.expectContract('deleteRateEntry', await ctx.delete(deletePath, 'staff'));
  });
});
