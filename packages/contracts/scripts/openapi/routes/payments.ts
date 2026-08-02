import { z } from 'zod';

import {
  billerQuerySchema,
  billPaymentQuerySchema,
  billPaymentSchema,
  configureAutopayRequestSchema,
  linkBillRequestSchema,
  linkedBillSchema,
  payBillRequestSchema,
} from '../../../src/index.js';
import { idSchema } from '../../../src/common/primitives.js';
import { PAGE_SCHEMAS } from '../components.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

const BILL_ID = { billId: idSchema } as const;

export const paymentsOperations = defineOperations([
  {
    method: 'get',
    path: '/payments/billers',
    tag: TAG.payments,
    operationId: 'listBillers',
    summary: 'The biller directory',
    query: billerQuerySchema,
    response: success(STATUS.ok, 'A cursor page of billers.', PAGE_SCHEMAS.BillerPage),
  },
  {
    method: 'get',
    path: '/payments/bills',
    tag: TAG.payments,
    operationId: 'listLinkedBills',
    summary: 'Bills the customer has linked',
    response: success(STATUS.ok, 'Linked bills with due amounts.', z.array(linkedBillSchema)),
  },
  {
    method: 'post',
    path: '/payments/bills',
    tag: TAG.payments,
    operationId: 'linkBill',
    summary: 'Link a biller by customer reference',
    request: linkBillRequestSchema,
    response: success(STATUS.created, 'The linked bill.', linkedBillSchema),
    errors: [
      { status: STATUS.unprocessable, description: 'The reference fails the biller’s format.' },
    ],
  },
  {
    method: 'delete',
    path: '/payments/bills/{billId}',
    tag: TAG.payments,
    operationId: 'unlinkBill',
    summary: 'Unlink a bill',
    pathParams: BILL_ID,
    response: success(STATUS.noContent, 'Bill unlinked.'),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'put',
    path: '/payments/bills/{billId}/autopay',
    tag: TAG.payments,
    operationId: 'configureAutopay',
    summary: 'Configure or disable autopay',
    pathParams: BILL_ID,
    request: configureAutopayRequestSchema,
    response: success(STATUS.ok, 'The updated bill.', linkedBillSchema),
    errors: [{ status: STATUS.notFound }, { status: STATUS.unprocessable }],
  },
  {
    method: 'post',
    path: '/payments',
    tag: TAG.payments,
    operationId: 'payBill',
    summary: 'Pay a bill now or schedule it',
    request: payBillRequestSchema,
    idempotent: true,
    response: success(STATUS.accepted, 'The payment.', billPaymentSchema),
    errors: [
      { status: STATUS.notFound, description: 'The bill does not exist.' },
      {
        status: STATUS.unprocessable,
        description: 'Insufficient funds or below the biller minimum.',
      },
    ],
  },
  {
    method: 'get',
    path: '/payments',
    tag: TAG.payments,
    operationId: 'listBillPayments',
    summary: 'Payment history',
    query: billPaymentQuerySchema,
    response: success(STATUS.ok, 'A cursor page of payments.', PAGE_SCHEMAS.BillPaymentPage),
  },
]);
