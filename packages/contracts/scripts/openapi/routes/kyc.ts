import { z } from 'zod';

import {
  attachDocumentRequestSchema,
  kycCaseSchema,
  kycDecisionRequestSchema,
  kycDocumentSchema,
  kycQueueQuerySchema,
  kycTierLimitsSchema,
  submitKycRequestSchema,
  uploadSignatureRequestSchema,
  uploadSignatureSchema,
} from '../../../src/index.js';
import { idSchema } from '../../../src/common/primitives.js';
import { PAGE_SCHEMAS } from '../components.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

export const kycOperations = defineOperations([
  {
    method: 'get', path: '/kyc/me', tag: TAG.kyc, operationId: 'getMyKycCase',
    summary: 'The authenticated customer’s current KYC case',
    response: success(STATUS.ok, 'The current case, or none started.', kycCaseSchema.nullable()),
  },
  {
    method: 'get', path: '/kyc/tiers', tag: TAG.kyc, operationId: 'listKycTiers',
    summary: 'What each KYC tier allows',
    response: success(STATUS.ok, 'The tier ladder and its limits.', z.array(kycTierLimitsSchema)),
  },
  {
    method: 'post', path: '/kyc/uploads/signature', tag: TAG.kyc, operationId: 'signKycUpload',
    summary: 'Mint a signed direct-to-storage upload for a document',
    request: uploadSignatureRequestSchema,
    response: success(STATUS.ok, 'The signed upload payload.', uploadSignatureSchema),
    errors: [{ status: STATUS.unprocessable }],
  },
  {
    method: 'post', path: '/kyc/documents', tag: TAG.kyc, operationId: 'attachKycDocument',
    summary: 'Attach an uploaded document to the current case',
    request: attachDocumentRequestSchema,
    response: success(STATUS.created, 'The attached document.', kycDocumentSchema),
    errors: [{ status: STATUS.unprocessable }],
  },
  {
    method: 'post', path: '/kyc/submit', tag: TAG.kyc, operationId: 'submitKyc',
    summary: 'Submit the case for review',
    request: submitKycRequestSchema,
    response: success(STATUS.accepted, 'The case, now pending review.', kycCaseSchema),
    errors: [{ status: STATUS.conflict }, { status: STATUS.unprocessable }],
  },
  {
    method: 'get', path: '/kyc/queue', tag: TAG.kyc, operationId: 'listKycQueue',
    summary: 'Review work queue with SLA ordering (staff)',
    query: kycQueueQuerySchema,
    response: success(STATUS.ok, 'Cases awaiting review.', PAGE_SCHEMAS.KycCasePage),
  },
  {
    method: 'get', path: '/kyc/cases/{caseId}', tag: TAG.kyc, operationId: 'getKycCase',
    summary: 'A KYC case with documents and checks (staff)',
    pathParams: { caseId: idSchema },
    response: success(STATUS.ok, 'The case.', kycCaseSchema),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'post', path: '/kyc/cases/{caseId}/decision', tag: TAG.kyc, operationId: 'decideKycCase',
    summary: 'Approve, reject, or request more information (staff)',
    pathParams: { caseId: idSchema },
    request: kycDecisionRequestSchema,
    response: success(STATUS.ok, 'The decided case.', kycCaseSchema),
    errors: [{ status: STATUS.notFound }, { status: STATUS.conflict }, { status: STATUS.unprocessable }],
  },
]);
