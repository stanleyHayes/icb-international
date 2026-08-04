import { type z } from 'zod';
import {
  billerQuerySchema,
  billerSchema,
  billPaymentQuerySchema,
  billPaymentSchema,
  configureAutopayRequestSchema,
  cursorPageSchema,
  itemsEnvelopeSchema,
  linkBillRequestSchema,
  linkedBillSchema,
  payBillRequestSchema,
} from '@icb/contracts';

import { del, get, patch, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const paymentsEndpoints = {
  listBillers: get('/billers', cursorPageSchema(billerSchema), {
    query: billerQuerySchema,
  }),
  listBills: get('/bills', itemsEnvelopeSchema(linkedBillSchema)),
  linkBill: post('/bills', linkedBillSchema, { body: linkBillRequestSchema }),
  getBill: get('/bills/:billId', linkedBillSchema),
  unlinkBill: del('/bills/:billId'),
  configureAutopay: patch('/bills/:billId/autopay', linkedBillSchema, {
    body: configureAutopayRequestSchema,
  }),
  pay: post('/bills/:billId/pay', billPaymentSchema, {
    body: payBillRequestSchema,
    idempotent: true,
  }),
  listPayments: get('/bill-payments', cursorPageSchema(billPaymentSchema), {
    query: billPaymentQuerySchema,
  }),
  getPayment: get('/bill-payments/:paymentId', billPaymentSchema),
  cancelPayment: post('/bill-payments/:paymentId/cancel', billPaymentSchema, {
    idempotent: true,
  }),
};

export function createPaymentsApi(call: Requester) {
  return {
    listBillers: (query?: z.input<typeof billerQuerySchema>, options?: RequestOptions) =>
      call(paymentsEndpoints.listBillers, { query, options }),
    listBills: (options?: RequestOptions) => call(paymentsEndpoints.listBills, { options }),
    linkBill: (body: z.input<typeof linkBillRequestSchema>, options?: RequestOptions) =>
      call(paymentsEndpoints.linkBill, { body, options }),
    getBill: (billId: string, options?: RequestOptions) =>
      call(paymentsEndpoints.getBill, { params: { billId }, options }),
    unlinkBill: (billId: string, options?: RequestOptions) =>
      call(paymentsEndpoints.unlinkBill, { params: { billId }, options }),
    configureAutopay: (
      billId: string,
      body: z.input<typeof configureAutopayRequestSchema>,
      options?: RequestOptions,
    ) => call(paymentsEndpoints.configureAutopay, { params: { billId }, body, options }),
    pay: (billId: string, body: z.input<typeof payBillRequestSchema>, options?: RequestOptions) =>
      call(paymentsEndpoints.pay, { params: { billId }, body, options }),
    listPayments: (query?: z.input<typeof billPaymentQuerySchema>, options?: RequestOptions) =>
      call(paymentsEndpoints.listPayments, { query, options }),
    getPayment: (paymentId: string, options?: RequestOptions) =>
      call(paymentsEndpoints.getPayment, { params: { paymentId }, options }),
    cancelPayment: (paymentId: string, options?: RequestOptions) =>
      call(paymentsEndpoints.cancelPayment, { params: { paymentId }, options }),
  };
}

export type PaymentsApi = ReturnType<typeof createPaymentsApi>;
