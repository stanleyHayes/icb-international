import { z } from 'zod';
import {
  billerQuerySchema,
  billerSchema,
  billPaymentQuerySchema,
  billPaymentSchema,
  configureAutopayRequestSchema,
  cursorPageSchema,
  linkBillRequestSchema,
  linkedBillSchema,
  payBillRequestSchema,
} from '@icb/contracts';

import { del, get, post, put, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const paymentsEndpoints = {
  listBillers: get('/payments/billers', cursorPageSchema(billerSchema)),
  listBills: get('/payments/bills', z.array(linkedBillSchema)),
  linkBill: post('/payments/bills', linkedBillSchema, { body: linkBillRequestSchema }),
  unlinkBill: del('/payments/bills/:billId'),
  configureAutopay: put('/payments/bills/:billId/autopay', linkedBillSchema, {
    body: configureAutopayRequestSchema,
  }),
  enquireBalance: post('/payments/bills/:billId/balance-enquiry', linkedBillSchema, {}),
  pay: post('/payments', billPaymentSchema, { body: payBillRequestSchema, idempotent: true }),
  listPayments: get('/payments', cursorPageSchema(billPaymentSchema)),
};

export function createPaymentsApi(call: Requester) {
  return {
    listBillers: (query?: z.input<typeof billerQuerySchema>, options?: RequestOptions) =>
      call(paymentsEndpoints.listBillers, { query, options }),
    listBills: (options?: RequestOptions) => call(paymentsEndpoints.listBills, { options }),
    linkBill: (body: z.input<typeof linkBillRequestSchema>, options?: RequestOptions) =>
      call(paymentsEndpoints.linkBill, { body, options }),
    unlinkBill: (billId: string, options?: RequestOptions) =>
      call(paymentsEndpoints.unlinkBill, { params: { billId }, options }),
    configureAutopay: (
      billId: string,
      body: z.input<typeof configureAutopayRequestSchema>,
      options?: RequestOptions,
    ) => call(paymentsEndpoints.configureAutopay, { params: { billId }, body, options }),
    enquireBalance: (billId: string, options?: RequestOptions) =>
      call(paymentsEndpoints.enquireBalance, { params: { billId }, options }),
    pay: (body: z.input<typeof payBillRequestSchema>, options?: RequestOptions) =>
      call(paymentsEndpoints.pay, { body, options }),
    listPayments: (query?: z.input<typeof billPaymentQuerySchema>, options?: RequestOptions) =>
      call(paymentsEndpoints.listPayments, { query, options }),
  };
}

export type PaymentsApi = ReturnType<typeof createPaymentsApi>;
