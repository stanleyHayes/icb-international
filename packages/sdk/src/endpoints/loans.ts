import { type z } from 'zod';
import {
  itemsEnvelopeSchema,
  loanApplicationRequestSchema,
  loanApplicationSchema,
  loanDetailSchema,
  loanDocumentUploadRequestSchema,
  loanProductSchema,
  loanQuoteRequestSchema,
  loanQuoteSchema,
  loanSchema,
  makeRepaymentRequestSchema,
  payoffQuoteSchema,
  uploadSignatureSchema,
} from '@icb/contracts';

import { get, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const loansEndpoints = {
  listProducts: get('/loans/products', itemsEnvelopeSchema(loanProductSchema)),
  quote: post('/loans/quote', loanQuoteSchema, { body: loanQuoteRequestSchema }),
  apply: post('/loans/applications', loanApplicationSchema, {
    body: loanApplicationRequestSchema,
    idempotent: true,
  }),
  listApplications: get('/loans/applications', itemsEnvelopeSchema(loanApplicationSchema)),
  getApplication: get('/loans/applications/:applicationId', loanApplicationSchema),
  uploadDocument: post('/loans/applications/:applicationId/documents', uploadSignatureSchema, {
    body: loanDocumentUploadRequestSchema,
    idempotent: true,
  }),
  acceptOffer: post('/loans/applications/:applicationId/accept', loanApplicationSchema, {
    idempotent: true,
  }),
  list: get('/loans', itemsEnvelopeSchema(loanSchema)),
  get: get('/loans/:loanId', loanDetailSchema),
  payoffQuote: get('/loans/:loanId/payoff-quote', payoffQuoteSchema),
  repay: post('/loans/:loanId/repayments', loanDetailSchema, {
    body: makeRepaymentRequestSchema,
    idempotent: true,
  }),
};

export function createLoansApi(call: Requester) {
  return {
    listProducts: (options?: RequestOptions) => call(loansEndpoints.listProducts, { options }),
    quote: (body: z.input<typeof loanQuoteRequestSchema>, options?: RequestOptions) =>
      call(loansEndpoints.quote, { body, options }),
    apply: (body: z.input<typeof loanApplicationRequestSchema>, options?: RequestOptions) =>
      call(loansEndpoints.apply, { body, options }),
    listApplications: (options?: RequestOptions) =>
      call(loansEndpoints.listApplications, { options }),
    getApplication: (applicationId: string, options?: RequestOptions) =>
      call(loansEndpoints.getApplication, { params: { applicationId }, options }),
    uploadDocument: (
      applicationId: string,
      body: z.input<typeof loanDocumentUploadRequestSchema>,
      options?: RequestOptions,
    ) => call(loansEndpoints.uploadDocument, { params: { applicationId }, body, options }),
    acceptOffer: (applicationId: string, options?: RequestOptions) =>
      call(loansEndpoints.acceptOffer, { params: { applicationId }, options }),
    list: (options?: RequestOptions) => call(loansEndpoints.list, { options }),
    get: (loanId: string, options?: RequestOptions) =>
      call(loansEndpoints.get, { params: { loanId }, options }),
    payoffQuote: (loanId: string, options?: RequestOptions) =>
      call(loansEndpoints.payoffQuote, { params: { loanId }, options }),
    repay: (
      loanId: string,
      body: z.input<typeof makeRepaymentRequestSchema>,
      options?: RequestOptions,
    ) => call(loansEndpoints.repay, { params: { loanId }, body, options }),
  };
}

export type LoansApi = ReturnType<typeof createLoansApi>;
