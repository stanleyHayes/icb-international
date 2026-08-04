import { afterAll, beforeAll, describe, it } from 'vitest';

import type { KycCase } from '@icb/contracts';
import { kycOperations } from '@icb/contracts/openapi/routes/kyc';
import { ContractContext, fillPath, operationOf, requireInfra } from '../contract-context.js';
import { bootContractApp, closeContractApp, type BootResult, type ContractApp } from '../harness.js';

/**
 * Contract suite: kyc.
 *
 * Drives the whole review lifecycle over HTTP — open the case, sign an upload, attach the
 * document, submit, then work the staff queue through to a decision — pinning every response
 * to its route-table schema. The case id flows between tests from the responses themselves;
 * nothing is hard-coded. Tests run in declaration order, so the lifecycle ordering is safe.
 */
describe('contract: kyc', () => {
  let boot: BootResult;
  let app: ContractApp | undefined;
  let ctx: ContractContext;
  let caseId = '';

  beforeAll(async () => {
    boot = await bootContractApp();
    if (boot.available) {
      app = boot.app;
      ctx = new ContractContext(app);
    }
  });

  afterAll(async () => {
    if (app && ctx) {
      ctx.assertCovered(kycOperations);
      await closeContractApp(app);
    }
  });

  it('getMyKycCase / getKycLimits — the customer’s case and the tier ladder', async (t) => {
    requireInfra(t, boot);
    const kycCase = ctx.expectContract('getMyKycCase', await ctx.get('/kyc/case')) as KycCase;
    caseId = kycCase.id;
    ctx.expectContract('getKycLimits', await ctx.get('/kyc/limits'));
  });

  it('signKycUpload — mints the declared direct-to-storage signature payload', async (t) => {
    requireInfra(t, boot);
    const res = await ctx.post('/kyc/upload-signature', {
      documentType: 'passport',
      filename: 'passport.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 102_400,
    });
    ctx.expectContract('signKycUpload', res);
  });

  it('attachKycDocument / submitKyc — a document on the case, then off for review', async (t) => {
    requireInfra(t, boot);
    const attached = await ctx.post('/kyc/documents', {
      type: 'passport',
      asset: {
        provider: 'cloudinary',
        publicId: 'kyc/contract-test/passport',
        resourceType: 'image',
        format: 'jpg',
        bytes: 102_400,
        uploadedAt: ctx.now().toISOString(),
      },
      documentNumber: 'G0123456',
      issuingCountry: 'GH',
    });
    ctx.expectContract('attachKycDocument', attached);

    const submitted = await ctx.post('/kyc/submit', {
      requestedLevel: 'tier_2',
      declarationAccepted: true,
    });
    caseId = (ctx.expectContract('submitKyc', submitted) as KycCase).id;
  });

  it('listKycQueue / getKycCase — the submitted case is visible to staff', async (t) => {
    requireInfra(t, boot);
    ctx.expectContract('listKycQueue', await ctx.get('/kyc/queue', 'staff'));
    const detailPath = fillPath(operationOf('getKycCase').path, { caseId });
    ctx.expectContract('getKycCase', await ctx.get(detailPath, 'staff'));
  });

  it('decideKycCase — a staff approval returns the declared decided-case shape', async (t) => {
    requireInfra(t, boot);
    const decisionPath = fillPath(operationOf('decideKycCase').path, { caseId });
    const res = await ctx.post(
      decisionPath,
      { outcome: 'approved', grantedLevel: 'tier_2', reason: 'Contract test approval' },
      'staff',
    );
    ctx.expectContract('decideKycCase', res);
  });
});
