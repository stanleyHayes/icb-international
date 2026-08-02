import { z } from 'zod';

import {
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
} from '../../../src/index.js';
import { idSchema } from '../../../src/common/primitives.js';
import { PAGE_SCHEMAS } from '../components.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

const LOAN_ID = { loanId: idSchema } as const;

export const loansOperations = defineOperations([
  {
    method: 'get', path: '/loans/products', tag: TAG.lending, operationId: 'listLoanProducts',
    summary: 'Loan products the customer can apply for',
    response: success(STATUS.ok, 'Available loan products.', z.array(loanProductSchema)),
  },
  {
    method: 'post', path: '/loans/quotes', tag: TAG.lending, operationId: 'quoteLoan',
    summary: 'Indicative quote with a full amortisation schedule',
    request: loanQuoteRequestSchema,
    response: success(STATUS.ok, 'The indicative quote.', loanQuoteSchema),
    errors: [{ status: STATUS.unprocessable }],
  },
  {
    method: 'post', path: '/loans/applications', tag: TAG.lending, operationId: 'applyForLoan',
    summary: 'Submit a loan application',
    request: loanApplicationRequestSchema,
    idempotent: true,
    response: success(STATUS.created, 'The application, entering underwriting.', loanApplicationSchema),
    errors: [
      { status: STATUS.unprocessable, description: 'The customer is not eligible for this product.' },
    ],
  },
  {
    method: 'get', path: '/loans/applications', tag: TAG.lending, operationId: 'listLoanApplications',
    summary: 'The customer’s applications',
    query: loanQuerySchema,
    response: success(STATUS.ok, 'A cursor page of applications.', PAGE_SCHEMAS.LoanApplicationPage),
  },
  {
    method: 'get', path: '/loans/applications/{applicationId}', tag: TAG.lending,
    operationId: 'getLoanApplication', summary: 'Application status with decision and offer',
    pathParams: { applicationId: idSchema },
    response: success(STATUS.ok, 'The application.', loanApplicationSchema),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'post', path: '/loans/applications/{applicationId}/accept', tag: TAG.lending,
    operationId: 'acceptLoanOffer', summary: 'Accept an approved offer, triggering disbursement',
    pathParams: { applicationId: idSchema },
    idempotent: true,
    response: success(STATUS.ok, 'The application after acceptance.', loanApplicationSchema),
    errors: [
      { status: STATUS.notFound },
      { status: STATUS.conflict, description: 'No open offer, or the offer has expired.' },
    ],
  },
  {
    method: 'get', path: '/loans', tag: TAG.lending, operationId: 'listLoans',
    summary: 'The customer’s loans',
    query: loanQuerySchema,
    response: success(STATUS.ok, 'A cursor page of loans.', PAGE_SCHEMAS.LoanPage),
  },
  {
    method: 'get', path: '/loans/{loanId}', tag: TAG.lending, operationId: 'getLoan',
    summary: 'Loan detail with repayment schedule',
    pathParams: LOAN_ID,
    response: success(STATUS.ok, 'The loan.', loanDetailSchema),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'get', path: '/loans/{loanId}/payoff-quote', tag: TAG.lending,
    operationId: 'getPayoffQuote', summary: 'What settling today would cost',
    pathParams: LOAN_ID,
    response: success(STATUS.ok, 'The payoff quote.', payoffQuoteSchema),
    errors: [{ status: STATUS.notFound }, { status: STATUS.conflict }],
  },
  {
    method: 'post', path: '/loans/{loanId}/repayments', tag: TAG.lending, operationId: 'makeRepayment',
    summary: 'Pay the next instalment, make an extra payment, or settle in full',
    pathParams: LOAN_ID,
    request: makeRepaymentRequestSchema,
    idempotent: true,
    response: success(STATUS.accepted, 'The loan after the repayment.', loanDetailSchema),
    errors: [
      { status: STATUS.notFound },
      { status: STATUS.conflict, description: 'The loan is already settled.' },
      { status: STATUS.unprocessable, description: 'Insufficient funds or amount above the balance.' },
    ],
  },
]);
