import { type z } from 'zod';
import {
  attachDocumentRequestSchema,
  kycCaseSchema,
  kycDecisionRequestSchema,
  kycLimitsResponseSchema,
  kycQueueQuerySchema,
  offsetPageSchema,
  submitKycRequestSchema,
  uploadSignatureRequestSchema,
  uploadSignatureSchema,
} from '@icb/contracts';

import { get, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const kycEndpoints = {
  currentCase: get('/kyc/case', kycCaseSchema),
  limits: get('/kyc/limits', kycLimitsResponseSchema),
  createUploadSignature: post('/kyc/upload-signature', uploadSignatureSchema, {
    body: uploadSignatureRequestSchema,
    idempotent: true,
  }),
  attachDocument: post('/kyc/documents', kycCaseSchema, {
    body: attachDocumentRequestSchema,
    idempotent: true,
  }),
  submit: post('/kyc/submit', kycCaseSchema, {
    body: submitKycRequestSchema,
    idempotent: true,
  }),
  adminQueue: get('/kyc/queue', offsetPageSchema(kycCaseSchema), {
    query: kycQueueQuerySchema,
  }),
  adminGetCase: get('/kyc/cases/:caseId', kycCaseSchema),
  adminDecide: post('/kyc/cases/:caseId/decision', kycCaseSchema, {
    body: kycDecisionRequestSchema,
  }),
};

export function createKycApi(call: Requester) {
  return {
    currentCase: (options?: RequestOptions) => call(kycEndpoints.currentCase, { options }),
    limits: (options?: RequestOptions) => call(kycEndpoints.limits, { options }),
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
