import { z } from 'zod';

import { cursorQuerySchema } from '../common/pagination.js';
import {
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  moneySchema,
  positiveMoneySchema,
} from '../common/primitives.js';

export const BILLER_CATEGORIES = [
  'electricity',
  'water',
  'internet',
  'mobile',
  'tv',
  'insurance',
  'education',
  'government',
  'rent',
  'other',
] as const;

export const billerCategorySchema = z.enum(BILLER_CATEGORIES);

export const billerSchema = z.object({
  id: idSchema,
  name: z.string(),
  category: billerCategorySchema,
  logoUrl: z.url().nullable(),
  /** What the customer's reference with this biller is called, e.g. "Meter number". */
  referenceLabel: z.string(),
  referencePattern: z.string().nullable(),
  supportsBalanceEnquiry: z.boolean(),
  minimumAmount: moneySchema.nullable(),
  active: z.boolean(),
});

export const linkedBillSchema = z.object({
  id: idSchema,
  billerId: idSchema,
  billerName: z.string(),
  billerLogoUrl: z.url().nullable(),
  category: billerCategorySchema,
  nickname: z.string().max(60).nullable(),
  customerReference: z.string(),
  /** Populated by a balance enquiry against the simulated biller. Null when unsupported. */
  outstandingBalance: moneySchema.nullable(),
  dueOn: isoDateSchema.nullable(),
  autopay: z
    .object({
      enabled: z.boolean(),
      fromAccountId: idSchema,
      strategy: z.enum(['full_balance', 'fixed_amount']),
      fixedAmount: moneySchema.nullable(),
      daysBeforeDue: z.int().min(0).max(30),
      capAmount: moneySchema.nullable(),
    })
    .nullable(),
  lastPaidAt: isoDateTimeSchema.nullable(),
  lastPaidAmount: moneySchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export const linkBillRequestSchema = z.object({
  billerId: idSchema,
  customerReference: z.string().min(1).max(60),
  nickname: z.string().max(60).optional(),
});

export const configureAutopayRequestSchema = z.object({
  enabled: z.boolean(),
  fromAccountId: idSchema,
  strategy: z.enum(['full_balance', 'fixed_amount']).default('full_balance'),
  fixedAmount: positiveMoneySchema.optional(),
  daysBeforeDue: z.int().min(0).max(30).default(2),
  capAmount: positiveMoneySchema.optional(),
});

export const payBillRequestSchema = z.object({
  billId: idSchema,
  fromAccountId: idSchema,
  amount: positiveMoneySchema,
  /** Omit for immediate payment. */
  scheduledFor: isoDateSchema.optional(),
});

export const billPaymentSchema = z.object({
  id: idSchema,
  billId: idSchema,
  billerName: z.string(),
  customerReference: z.string(),
  amount: moneySchema,
  fee: moneySchema,
  status: z.enum(['scheduled', 'processing', 'completed', 'failed', 'cancelled', 'refunded']),
  /** The biller's own confirmation identifier — what a customer quotes when disputing. */
  billerReference: z.string().nullable(),
  failureReason: z.string().nullable(),
  transactionId: idSchema.nullable(),
  scheduledFor: isoDateTimeSchema.nullable(),
  paidAt: isoDateTimeSchema.nullable(),
  createdAt: isoDateTimeSchema,
});

export const billerQuerySchema = cursorQuerySchema.extend({
  q: z.string().max(80).optional(),
  category: billerCategorySchema.optional(),
});

export const billPaymentQuerySchema = cursorQuerySchema.extend({
  billId: idSchema.optional(),
  status: z.array(z.enum(['scheduled', 'processing', 'completed', 'failed', 'cancelled'])).optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export type Biller = z.infer<typeof billerSchema>;
export type LinkedBill = z.infer<typeof linkedBillSchema>;
export type BillPayment = z.infer<typeof billPaymentSchema>;
export type LinkBillRequest = z.infer<typeof linkBillRequestSchema>;
export type PayBillRequest = z.infer<typeof payBillRequestSchema>;
export type ConfigureAutopayRequest = z.infer<typeof configureAutopayRequestSchema>;
export type BillerCategory = (typeof BILLER_CATEGORIES)[number];
