import { type z } from 'zod';
import {
  beneficiaryQuerySchema,
  beneficiarySchema,
  beneficiaryVerificationSchema,
  createBeneficiaryRequestSchema,
  cursorPageSchema,
  updateBeneficiaryRequestSchema,
  verifyBeneficiaryRequestSchema,
} from '@icb/contracts';

import { del, get, patch, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const beneficiariesEndpoints = {
  list: get('/beneficiaries', cursorPageSchema(beneficiarySchema), {
    query: beneficiaryQuerySchema,
  }),
  create: post('/beneficiaries', beneficiarySchema, {
    body: createBeneficiaryRequestSchema,
    idempotent: true,
  }),
  update: patch('/beneficiaries/:beneficiaryId', beneficiarySchema, {
    body: updateBeneficiaryRequestSchema,
  }),
  remove: del('/beneficiaries/:beneficiaryId'),
  getVerification: get('/beneficiaries/:beneficiaryId/verification', beneficiaryVerificationSchema),
  sendVerificationDeposits: post(
    '/beneficiaries/:beneficiaryId/verification/deposits',
    beneficiaryVerificationSchema,
    { idempotent: true },
  ),
  confirmVerification: post(
    '/beneficiaries/:beneficiaryId/verification/confirm',
    beneficiaryVerificationSchema,
    { body: verifyBeneficiaryRequestSchema, idempotent: true },
  ),
};

export function createBeneficiariesApi(call: Requester) {
  return {
    list: (query?: z.input<typeof beneficiaryQuerySchema>, options?: RequestOptions) =>
      call(beneficiariesEndpoints.list, { query, options }),
    create: (body: z.input<typeof createBeneficiaryRequestSchema>, options?: RequestOptions) =>
      call(beneficiariesEndpoints.create, { body, options }),
    update: (
      beneficiaryId: string,
      body: z.input<typeof updateBeneficiaryRequestSchema>,
      options?: RequestOptions,
    ) => call(beneficiariesEndpoints.update, { params: { beneficiaryId }, body, options }),
    remove: (beneficiaryId: string, options?: RequestOptions) =>
      call(beneficiariesEndpoints.remove, { params: { beneficiaryId }, options }),
    getVerification: (beneficiaryId: string, options?: RequestOptions) =>
      call(beneficiariesEndpoints.getVerification, { params: { beneficiaryId }, options }),
    sendVerificationDeposits: (beneficiaryId: string, options?: RequestOptions) =>
      call(beneficiariesEndpoints.sendVerificationDeposits, { params: { beneficiaryId }, options }),
    confirmVerification: (
      beneficiaryId: string,
      body: z.input<typeof verifyBeneficiaryRequestSchema>,
      options?: RequestOptions,
    ) =>
      call(beneficiariesEndpoints.confirmVerification, {
        params: { beneficiaryId },
        body,
        options,
      }),
  };
}

export type BeneficiariesApi = ReturnType<typeof createBeneficiariesApi>;
