import { KYC_CHECK_KINDS, type SubmitKycRequest } from '@icb/contracts';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError, ValidationError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { type KycDecisionService } from '../application/kyc-decision.service.js';
import { type KycQueueService } from '../application/kyc-queue.service.js';
import { type UploadSignatureService } from '../application/upload-signature.service.js';
import type { KycCaseDoc, KycDocumentSub } from '../infrastructure/kyc.schemas.js';
import { KycService } from '../kyc.service.js';
import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import {
  ASSET,
  CASE_ID,
  CUSTOMER_ID,
  NOW,
  chainQuery,
  customerDoc,
  kycCaseDoc,
  kycDocumentSub,
} from './fixtures.js';

type AttachRequest = {
  type: 'passport' | 'national_id';
  asset: typeof ASSET;
  documentNumber?: string;
  issuingCountry?: string;
};

function setup(latest: KycCaseDoc | null, customer: CustomerDoc | null = customerDoc()) {
  const cases = {
    findOne: vi.fn().mockReturnValue(chainQuery(latest)),
    findOneAndUpdate: vi.fn().mockReturnValue(
      chainQuery(kycCaseDoc({ status: 'pending_review', updatedAt: NOW })),
    ),
    create: vi.fn(),
  };
  cases.create.mockImplementation((doc: KycCaseDoc) =>
    Promise.resolve({ toObject: () => doc }),
  );
  const customers = { findById: vi.fn().mockReturnValue(chainQuery(customer)) };
  const signatures = { mint: vi.fn() };
  const queue = { list: vi.fn(), byId: vi.fn() };
  const decisions = { decide: vi.fn() };
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new KycService(
    cases as unknown as Model<KycCaseDoc>,
    customers as unknown as Model<CustomerDoc>,
    signatures as unknown as UploadSignatureService,
    queue as unknown as KycQueueService,
    decisions as unknown as KycDecisionService,
    clock,
  );
  return { service, cases, customers, signatures, queue, decisions };
}

describe('KycService.caseFor', () => {
  it('returns the live case when one is already open', async () => {
    const { service, cases } = setup(kycCaseDoc({ status: 'in_progress' }));

    const result = await service.caseFor(CUSTOMER_ID);

    expect(cases.findOne).toHaveBeenCalledWith({ customerId: CUSTOMER_ID });
    expect(cases.create).not.toHaveBeenCalled();
    expect(result.id).toBe(CASE_ID);
    expect(result.status).toBe('in_progress');
  });

  it('opens a fresh case when the customer has never asked', async () => {
    const { service, cases } = setup(null);

    const result = await service.caseFor(CUSTOMER_ID);

    expect(cases.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: CUSTOMER_ID,
        customerName: 'Ada Lovelace',
        customerType: 'individual',
        requestedLevel: 'tier_1',
        status: 'not_started',
        documents: [],
        checks: [],
        riskRating: null,
        decision: null,
        submittedAt: null,
        createdAt: NOW,
        updatedAt: NOW,
      }),
    );
    expect(result.status).toBe('not_started');
    expect(result.customerName).toBe('Ada Lovelace');
  });

  it('opens a fresh case when the last one was decided, named for a business customer', async () => {
    const { service, cases } = setup(
      kycCaseDoc({ status: 'approved' }),
      customerDoc({ type: 'business', business: { legalName: 'Northwind Trading Ltd' } }),
    );

    const result = await service.caseFor(CUSTOMER_ID);

    expect(cases.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerName: 'Northwind Trading Ltd',
        customerType: 'business',
        status: 'not_started',
      }),
    );
    expect(result.status).toBe('not_started');
  });

  it('propagates the typed not-found for an unknown customer', async () => {
    const { service, cases } = setup(null, null);

    await expect(service.caseFor(CUSTOMER_ID)).rejects.toThrow(NotFoundError);
    expect(cases.create).not.toHaveBeenCalled();
  });
});

describe('KycService.attachDocument', () => {
  const REQUEST: AttachRequest = { type: 'passport', asset: ASSET, documentNumber: 'P1234567' };

  it('adds the document, restamps the case in progress, and returns the updated view', async () => {
    const { service, cases } = setup(kycCaseDoc());

    const result = await service.attachDocument(CUSTOMER_ID, REQUEST);

    const patch = cases.findOneAndUpdate.mock.calls[0] as unknown[];
    const update = (patch[1] as { $set: Record<string, unknown> })['$set'];
    expect(patch[0]).toEqual({ _id: CASE_ID });
    expect(update['status']).toBe('in_progress');
    expect(update['updatedAt']).toEqual(NOW);
    const documents = update['documents'] as KycDocumentSub[];
    expect(documents).toHaveLength(1);
    expect(documents[0]).toMatchObject({
      type: 'passport',
      asset: ASSET,
      status: 'uploaded',
      documentNumber: 'P1234567',
      issuingCountry: null,
      uploadedAt: NOW,
      reviewedAt: null,
    });
    expect(result.status).toBe('pending_review');
  });

  it('replaces a previous upload of the same type and keeps the others', async () => {
    const oldPassport = kycDocumentSub({ id: 'doc-old', type: 'passport' });
    const selfie = kycDocumentSub({ id: 'doc-selfie', type: 'selfie' });
    const { service, cases } = setup(kycCaseDoc({ documents: [oldPassport, selfie] }));

    await service.attachDocument(CUSTOMER_ID, { type: 'passport', asset: ASSET });

    const update = (cases.findOneAndUpdate.mock.calls[0] as unknown[])[1] as {
      $set: { documents: KycDocumentSub[] };
    };
    expect(update.$set.documents.map((document) => document.id)).toEqual([
      'doc-selfie',
      expect.any(String),
    ]);
    expect(update.$set.documents).toHaveLength(2);
  });

  it('refuses to attach while the case is under review', async () => {
    const { service, cases } = setup(kycCaseDoc({ status: 'pending_review' }));

    await expect(service.attachDocument(CUSTOMER_ID, REQUEST)).rejects.toThrow(ConflictError);
    expect(cases.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('propagates the typed not-found when the case vanishes between reads', async () => {
    const { service, cases } = setup(kycCaseDoc());
    cases.findOneAndUpdate.mockReturnValue(chainQuery(null));

    await expect(service.attachDocument(CUSTOMER_ID, REQUEST)).rejects.toThrow(NotFoundError);
  });
});

describe('KycService.submit', () => {
  const SUBMIT: SubmitKycRequest = { requestedLevel: 'tier_2', declarationAccepted: true };

  it('refuses a submission without a single attached document', async () => {
    const { service, cases } = setup(kycCaseDoc({ documents: [] }));

    await expect(service.submit(CUSTOMER_ID, SUBMIT)).rejects.toThrow(ValidationError);
    expect(cases.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('refuses to submit a case already under review', async () => {
    const { service, cases } = setup(
      kycCaseDoc({ status: 'pending_review', documents: [kycDocumentSub()] }),
    );

    await expect(service.submit(CUSTOMER_ID, SUBMIT)).rejects.toThrow(ConflictError);
    expect(cases.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('propagates the typed not-found for an unknown customer', async () => {
    const { service, cases } = setup(null, null);

    await expect(service.submit(CUSTOMER_ID, SUBMIT)).rejects.toThrow(NotFoundError);
    expect(cases.create).not.toHaveBeenCalled();
  });

  it('runs the individual check suite, stamps the SLA deadline, and clears any old decision', async () => {
    const existing = kycCaseDoc({
      documents: [kycDocumentSub()],
      decision: {
        outcome: 'more_info_required',
        grantedLevel: null,
        reason: 'Send a clearer scan',
        decidedBy: 'ops-1',
        decidedAt: NOW,
      },
    });
    const { service, cases } = setup(existing);

    await service.submit(CUSTOMER_ID, SUBMIT);

    const update = (cases.findOneAndUpdate.mock.calls[0] as unknown[])[1] as {
      $set: Record<string, unknown>;
    };
    expect(update.$set['requestedLevel']).toBe('tier_2');
    expect(update.$set['status']).toBe('pending_review');
    expect(update.$set['decision']).toBeNull();
    expect(update.$set['submittedAt']).toEqual(NOW);
    expect(update.$set['slaDueAt']).toEqual(new Date(NOW.getTime() + 48 * 60 * 60 * 1000));
    expect(update.$set['updatedAt']).toEqual(NOW);
    const checks = update.$set['checks'] as { kind: string; outcome: string }[];
    expect(checks.map((check) => check.kind)).toEqual(
      KYC_CHECK_KINDS.filter((kind) => kind !== 'business_registry'),
    );
    for (const check of checks) {
      expect(['pass', 'fail', 'refer']).toContain(check.outcome);
    }
    expect(['low', 'medium', 'high']).toContain(update.$set['riskRating']);
  });

  it('adds the registry check for a business customer', async () => {
    const { service, cases } = setup(
      kycCaseDoc({ customerType: 'business', documents: [kycDocumentSub()] }),
      customerDoc({ type: 'business', business: { legalName: 'Northwind Trading Ltd' } }),
    );

    await service.submit(CUSTOMER_ID, SUBMIT);

    const update = (cases.findOneAndUpdate.mock.calls[0] as unknown[])[1] as {
      $set: { checks: { kind: string }[] };
    };
    expect(update.$set.checks.map((check) => check.kind)).toEqual([...KYC_CHECK_KINDS]);
  });
});
