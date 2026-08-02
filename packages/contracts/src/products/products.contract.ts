import { z } from 'zod';

import { accountKindSchema } from '../common/enums.js';
import { currencySchema, idSchema, isoDateTimeSchema, moneySchema } from '../common/primitives.js';

// ---- Products & pricing ---------------------------------------------------

export const feeSchema = z.object({
  code: z.string(),
  label: z.string(),
  basis: z.enum(['flat', 'percentage', 'tiered']),
  amount: moneySchema.nullable(),
  percentage: z.number().nullable(),
  minimum: moneySchema.nullable(),
  maximum: moneySchema.nullable(),
  waivedForTiers: z.array(z.string()),
});

export const productSchema = z.object({
  code: z.string(),
  name: z.string(),
  tagline: z.string(),
  description: z.string(),
  kind: accountKindSchema,
  currencies: z.array(currencySchema),
  interestRate: z.number().nullable(),
  interestBands: z
    .array(z.object({ fromMinorUnits: z.int(), rate: z.number() }))
    .nullable(),
  minimumOpeningBalance: moneySchema.nullable(),
  minimumBalance: moneySchema.nullable(),
  monthlyFee: moneySchema.nullable(),
  fees: z.array(feeSchema),
  features: z.array(z.string()),
  eligibility: z.object({
    minimumAge: z.int().nullable(),
    minimumKycLevel: z.string().nullable(),
    residentsOnly: z.boolean(),
    businessOnly: z.boolean(),
  }),
  active: z.boolean(),
  displayOrder: z.int(),
});

export const rateTableSchema = z.object({
  effectiveFrom: isoDateTimeSchema,
  savings: z.array(z.object({ productCode: z.string(), name: z.string(), rate: z.number() })),
  deposits: z.array(
    z.object({ termMonths: z.int(), rate: z.number(), minimumAmount: moneySchema }),
  ),
  loans: z.array(
    z.object({ productCode: z.string(), name: z.string(), fromRate: z.number(), toRate: z.number() }),
  ),
});

// ---- FX -------------------------------------------------------------------

export const fxRateSchema = z.object({
  pair: z.string().regex(/^[A-Z]{3}\/[A-Z]{3}$/),
  base: currencySchema,
  quote: currencySchema,
  mid: z.number().positive(),
  buy: z.number().positive(),
  sell: z.number().positive(),
  spreadBps: z.int().nonnegative(),
  changePercent24h: z.number(),
  effectiveAt: isoDateTimeSchema,
});

export const fxQuoteRequestSchema = z.object({
  from: currencySchema,
  to: currencySchema,
  amountMinorUnits: z.int().positive(),
  amountSide: z.enum(['sell', 'buy']).default('sell'),
});

export const fxQuoteSchema = z.object({
  quoteId: idSchema,
  from: moneySchema,
  to: moneySchema,
  rate: z.number().positive(),
  midRate: z.number().positive(),
  spreadBps: z.int().nonnegative(),
  expiresAt: isoDateTimeSchema,
  /** Seconds remaining — drives the countdown the customer sees before confirming. */
  validForSeconds: z.int().positive(),
});


export type Product = z.infer<typeof productSchema>;
export type RateTable = z.infer<typeof rateTableSchema>;
export type Fee = z.infer<typeof feeSchema>;
export type FxRate = z.infer<typeof fxRateSchema>;
export type FxQuote = z.infer<typeof fxQuoteSchema>;
