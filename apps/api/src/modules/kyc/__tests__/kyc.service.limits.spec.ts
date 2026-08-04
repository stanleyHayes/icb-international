import type { KycDecisionRequest, KycQueueQuery } from '@icb/contracts';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { type DecisionActor, type KycDecisionService } from '../application/kyc-decision.service.js';
import { type KycQueueService } from '../application/kyc-queue.service.js';
import { type UploadSignatureService } from '../application/upload-signature.service.js';
import type { KycCaseDoc } from '../infrastructure/kyc.schemas.js';
import { KycService } from '../kyc.service.js';
import { CASE_ID, CUSTOMER_ID, NOW, chainQuery, customerDoc, kycCaseDoc } from './fixtures.js';

const UPLOAD_REQUEST = {
  documentType: 'passport',
  filename: 'passport.png',
  contentType: 'image/png',
  sizeBytes: 12_345,
} as const;

function setup(customer: CustomerDoc | null = customerDoc()) {
  const cases = {
    findOne: vi.fn().mockReturnValue(chainQuery(kycCaseDoc())),
    findOneAndUpdate: vi.fn(),
    create: vi.fn(),
  };
  const customers = { findById: vi.fn().mockReturnValue(chainQuery(customer)) };
  const signatures = { mint: vi.fn().mockReturnValue({ apiKey: 'local' }) };
  const page = { items: [], page: 1, limit: 25, total: 0, totalPages: 0 };
  const queue = {
    list: vi.fn().mockResolvedValue(page),
    byId: vi.fn().mockResolvedValue(kycCaseDoc()),
  };
  const decisions = { decide: vi.fn().mockResolvedValue({ id: CASE_ID }) };
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
  return { service, signatures, queue, decisions, page };
}

describe('KycService limits', () => {
  it('holds an unverified customer to the tier-1 floor', async () => {
    const { service } = setup(customerDoc({ kycStatus: 'not_started', kycLevel: null }));

    const limits = await service.limitsForCustomer(CUSTOMER_ID);

    expect(limits.level).toBe('tier_1');
    expect(limits.internationalAllowed).toBe(false);
  });

  it('reads the level only when the customer record says approved', async () => {
    const { service } = setup(customerDoc({ kycStatus: 'approved', kycLevel: 'tier_3' }));

    const limits = await service.limitsForCustomer(CUSTOMER_ID);

    expect(limits.level).toBe('tier_3');
    expect(limits.internationalAllowed).toBe(true);
  });

  it('ignores a stored level while verification is still in flight', async () => {
    const { service } = setup(customerDoc({ kycStatus: 'pending_review', kycLevel: 'tier_3' }));

    const limits = await service.limitsForCustomer(CUSTOMER_ID);

    expect(limits.level).toBe('tier_1');
  });

  it('propagates the typed not-found for an unknown customer', async () => {
    const { service } = setup(null);

    await expect(service.limitsForCustomer(CUSTOMER_ID)).rejects.toThrow(NotFoundError);
  });

  it('exposes the tier table to the transfer pipeline without touching the database', () => {
    const { service } = setup();

    expect(service.getLimitsFor('tier_2').level).toBe('tier_2');
    expect(service.getLimitsFor(null).level).toBe('tier_1');
    expect(service.listLimits().map((limits) => limits.level)).toEqual([
      'tier_1',
      'tier_2',
      'tier_3',
    ]);
  });
});

describe('KycService delegation', () => {
  it('mints upload signatures through the signature service', () => {
    const { service, signatures } = setup();

    const result = service.mintUploadSignature(CUSTOMER_ID, UPLOAD_REQUEST);

    expect(signatures.mint).toHaveBeenCalledWith(CUSTOMER_ID, UPLOAD_REQUEST);
    expect(result).toEqual({ apiKey: 'local' });
  });

  it('hands queue queries to the queue service untouched', async () => {
    const { service, queue, page } = setup();
    const query: KycQueueQuery = { page: 2, limit: 10, overdueOnly: true };

    const result = await service.listQueue(query);

    expect(queue.list).toHaveBeenCalledWith(query);
    expect(result).toBe(page);
  });

  it('maps a staff case lookup through the queue service', async () => {
    const { service, queue } = setup();

    const result = await service.caseById(CASE_ID);

    expect(queue.byId).toHaveBeenCalledWith(CASE_ID);
    expect(result.id).toBe(CASE_ID);
  });

  it('hands decisions to the decision service with the actor and request', async () => {
    const { service, decisions } = setup();
    const actor: DecisionActor = { id: 'staff-1', label: 'Grace Hopper' };
    const request: KycDecisionRequest = { outcome: 'rejected', reason: 'Expired passport' };

    const result = await service.decide(CASE_ID, actor, request);

    expect(decisions.decide).toHaveBeenCalledWith(CASE_ID, actor, request);
    expect(result).toEqual({ id: CASE_ID });
  });
});
