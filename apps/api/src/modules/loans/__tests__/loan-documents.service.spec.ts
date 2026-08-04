import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { LoanApplicationDoc } from '../infrastructure/loan-application.schemas.js';
import { LoanDocumentsService } from '../loan-documents.service.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');

const ASSET = {
  provider: 'cloudinary',
  publicId: 'icb/loans/app-1/payslip-a1b2',
  resourceType: 'image',
  format: 'png',
  bytes: 12_345,
  uploadedAt: NOW.toISOString(),
} as const;

function applicationDoc(overrides: Partial<LoanApplicationDoc> = {}): LoanApplicationDoc {
  return {
    _id: 'app-1',
    reference: 'LNA-TEST',
    customerId: 'cust-1',
    productCode: 'ICB-PL',
    productName: 'Personal loan',
    status: 'submitted',
    requestedMinorUnits: 500_000,
    currency: 'USD',
    termMonths: 36,
    frequency: 'monthly',
    purpose: 'home_improvement',
    purposeDetail: null,
    disbursementAccountId: 'acct-1',
    repaymentAccountId: 'acct-1',
    declaredMonthlyIncomeMinorUnits: 300_000,
    declaredMonthlyExpensesMinorUnits: 120_000,
    existingCommitmentsMinorUnits: 20_000,
    documents: [],
    decision: null,
    offer: null,
    loanId: null,
    submittedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function setup(doc: LoanApplicationDoc | null = applicationDoc()) {
  const applications = { updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }) };
  const repository = {
    requireApplication: vi.fn().mockImplementation(() => {
      if (!doc) {
        return Promise.reject(new NotFoundError('Loan application', 'app-1'));
      }
      return Promise.resolve(doc);
    }),
    applications,
  };
  const config = {
    media: {
      enabled: false,
      folder: 'icb',
      apiKey: '',
      apiSecret: '',
      cloudName: '',
      signedUrlTtlSeconds: 300,
    },
    http: { host: '0.0.0.0', port: 3001 },
  } as AppConfiguration;
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new LoanDocumentsService(repository as never, config, clock);
  return { service, repository, applications };
}

const UPLOAD_REQUEST = {
  label: 'payslip',
  filename: 'payslip-july.png',
  contentType: 'image/png',
  sizeBytes: 12_345,
} as const;

describe('LoanDocumentsService.mintUploadSignature', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('mints a grant scoped to the application folder, pointing at the local upload path', async () => {
    const grant = await context.service.mintUploadSignature('app-1', 'cust-1', UPLOAD_REQUEST);

    expect(grant.folder).toBe('icb/loans/app-1');
    expect(grant.publicId).toMatch(/^payslip-/);
    expect(grant.uploadUrl).toBe('http://localhost:3001/v1/media/local-upload');
    expect(grant.apiKey).toBe('local');
    expect(grant.signature).toMatch(/^[0-9a-f]{40}$/);
  });

  it('refuses to mint for an application the customer does not own', async () => {
    context = setup(null);

    await expect(
      context.service.mintUploadSignature('app-1', 'cust-2', UPLOAD_REQUEST),
    ).rejects.toThrow(NotFoundError);
  });

  it('refuses to mint once the application is decided', async () => {
    context = setup(applicationDoc({ status: 'approved' }));

    await expect(
      context.service.mintUploadSignature('app-1', 'cust-1', UPLOAD_REQUEST),
    ).rejects.toThrow(ConflictError);
  });
});

describe('LoanDocumentsService.attach', () => {
  it('pushes the asset ref onto the application and returns the updated view', async () => {
    const doc = applicationDoc();
    const { service, applications, repository } = setup(doc);

    const updated = await service.attach('app-1', 'cust-1', { label: 'payslip', asset: ASSET });

    expect(applications.updateOne).toHaveBeenCalledWith(
      { _id: 'app-1' },
      {
        $push: { documents: { label: 'payslip', asset: ASSET } },
        $set: { updatedAt: NOW },
      },
    );
    expect(repository.requireApplication).toHaveBeenCalledWith('app-1', 'cust-1');
    expect(updated.id).toBe('app-1');
    expect(updated.documents).toEqual(doc.documents);
  });

  it('refuses to attach to an application the customer does not own', async () => {
    const { service, applications } = setup(null);

    await expect(
      service.attach('app-1', 'cust-2', { label: 'payslip', asset: ASSET }),
    ).rejects.toThrow(NotFoundError);
    expect(applications.updateOne).not.toHaveBeenCalled();
  });

  it('refuses to attach once the application is decided', async () => {
    const { service, applications } = setup(applicationDoc({ status: 'offered' }));

    await expect(
      service.attach('app-1', 'cust-1', { label: 'payslip', asset: ASSET }),
    ).rejects.toThrow(ConflictError);
    expect(applications.updateOne).not.toHaveBeenCalled();
  });
});
