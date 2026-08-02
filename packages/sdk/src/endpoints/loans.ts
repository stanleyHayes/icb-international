import { z } from 'zod';
import {
  cursorPageSchema,
  cursorQuerySchema,
  loanApplicationRequestSchema,
  loanApplicationSchema,
  loanDetailSchema,
  loanProductSchema,
  loanQuerySchema,
  loanQuoteRequestSchema,
  loanQuoteSchema,
  loanSchema,
  makeRepaymentRequestSchema,
  payoffQuoteSchema,
} from '@icb/contracts';

import { get, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const loansEndpoints = {
  listProducts: get('/loans/products', z.array(loanProductSchema)),
  quote: post('/loans/quotes', loanQuoteSchema, { body: loanQuoteRequestSchema }),
  apply: post('/loans/applications', loanApplicationSchema, {
    body: loanApplicationRequestSchema,
    idempotent: true,
  }),
  listApplications: get('/loans/applications', cursorPageSchema(loanApplicationSchema)),
  getApplication: get('/loans/applications/:applicationId', loanApplicationSchema),
  acceptOffer: post('/loans/applications/:applicationId/accept', loanApplicationSchema, {
    idempotent: true,
  }),
  list: get('/loans', cursorPageSchema(loanSchema)),
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
    listApplications: (query?: z.input<typeof cursorQuerySchema>, options?: RequestOptions) =>
      call(loansEndpoints.listApplications, { query, options }),
    getApplication: (applicationId: string, options?: RequestOptions) =>
      call(loansEndpoints.getApplication, { params: { applicationId }, options }),
    acceptOffer: (applicationId: string, options?: RequestOptions) =>
      call(loansEndpoints.acceptOffer, { params: { applicationId }, options }),
    list: (query?: z.input<typeof loanQuerySchema>, options?: RequestOptions) =>
      call(loansEndpoints.list, { query, options }),
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
