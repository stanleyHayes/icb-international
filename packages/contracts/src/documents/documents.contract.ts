import { z } from 'zod';

import { assetRefSchema, idSchema, isoDateTimeSchema, moneySchema } from '../common/primitives.js';

// ---- Statements & documents -----------------------------------------------

export const statementSchema = z.object({
  id: idSchema,
  accountId: idSchema,
  accountLabel: z.string(),
  period: z.string().regex(/^\d{4}-\d{2}$/),
  from: z.iso.date(),
  to: z.iso.date(),
  openingBalance: moneySchema,
  closingBalance: moneySchema,
  totalCredits: moneySchema,
  totalDebits: moneySchema,
  transactionCount: z.int().nonnegative(),
  asset: assetRefSchema.nullable(),
  generatedAt: isoDateTimeSchema,
});

export const generateStatementRequestSchema = z.object({
  accountId: idSchema,
  from: z.iso.date(),
  to: z.iso.date(),
});

export const documentSchema = z.object({
  id: idSchema,
  kind: z.enum(['statement', 'tax_certificate', 'balance_letter', 'reference_letter', 'contract']),
  title: z.string(),
  accountId: idSchema.nullable(),
  asset: assetRefSchema,
  sizeBytes: z.int().nonnegative(),
  createdAt: isoDateTimeSchema,
});

/** A short-lived signed URL. Regenerated per request; never persisted. */
export const downloadLinkSchema = z.object({
  url: z.url(),
  expiresAt: isoDateTimeSchema,
  filename: z.string(),
});


export type Statement = z.infer<typeof statementSchema>;
export type BankDocument = z.infer<typeof documentSchema>;
export type DownloadLink = z.infer<typeof downloadLinkSchema>;
