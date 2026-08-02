import { z } from 'zod';
import {
  attachDocumentRequestSchema,
  kycCaseSchema,
  kycDecisionRequestSchema,
  kycDocumentSchema,
  kycQueueQuerySchema,
  kycTierLimitsSchema,
  offsetPageSchema,
  submitKycRequestSchema,
  uploadSignatureRequestSchema,
  uploadSignatureSchema,
} from '@icb/contracts';

import { get, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const kycEndpoints = {
  tiers: get('/kyc/tiers', z.array(kycTierLimitsSchema)),
  currentCase: get('/kyc/me', kycCaseSchema.nullable()),
  createUploadSignature: post('/kyc/uploads/signature', uploadSignatureSchema, {
    body: uploadSignatureRequestSchema,
    idempotent: true,
  }),
  attachDocument: post('/kyc/documents', kycDocumentSchema, {
    body: attachDocumentRequestSchema,
    idempotent: true,
  }),
  submit: post('/kyc/submissions', kycCaseSchema, {
    body: submitKycRequestSchema,
    idempotent: true,
  }),
  adminQueue: get('/admin/kyc/cases', offsetPageSchema(kycCaseSchema), {
    query: kycQueueQuerySchema,
  }),
  adminGetCase: get('/admin/kyc/cases/:caseId', kycCaseSchema),
  adminDecide: post('/admin/kyc/cases/:caseId/decision', kycCaseSchema, {
    body: kycDecisionRequestSchema,
  }),
};

export function createKycApi(call: Requester) {
  return {
    tiers: (options?: RequestOptions) => call(kycEndpoints.tiers, { options }),
    currentCase: (options?: RequestOptions) => call(kycEndpoints.currentCase, { options }),
    createUploadSignature: (
      body: z.input<typeof uploadSignatureRequestSchema>,
      options?: RequestOptions,
    ) => call(kycEndpoints.createUploadSignature, { body, options }),
    attachDocument: (body: z.input<typeof attachDocumentRequestSchema>, options?: RequestOptions) =>
      call(kycEndpoints.attachDocument, { body, options }),
    submit: (body: z.input<typeof submitKycRequestSchema>, options?: RequestOptions) =>
      call(kycEndpoints.submit, { body, options }),
    adminQueue: (query?: z.input<typeof kycQueueQuerySchema>, options?: RequestOptions) =>
      call(kycEndpoints.adminQueue, { query, options }),
    adminGetCase: (caseId: string, options?: RequestOptions) =>
      call(kycEndpoints.adminGetCase, { params: { caseId }, options }),
    adminDecide: (
      caseId: string,
      body: z.input<typeof kycDecisionRequestSchema>,
      options?: RequestOptions,
    ) => call(kycEndpoints.adminDecide, { params: { caseId }, body, options }),
  };
}

export type KycApi = ReturnType<typeof createKycApi>;
