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

/**
 * A grant request for a document the customer uploads themselves. `purpose` selects the folder
 * and the allow-list the asset store applies, so a dispute attachment cannot be filed as KYC.
 */
export const documentUploadRequestSchema = z.object({
  purpose: z.enum(['kyc', 'dispute-evidence']),
  filename: z.string().min(1).max(255),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  sizeBytes: z.int().positive().max(15 * 1024 * 1024),
});

/** Letters the bank issues on request. Both quote figures true at the moment of issue. */
export const issueLetterRequestSchema = z.object({
  kind: z.enum(['balance_letter', 'reference_letter']),
  /** Required for a balance confirmation — the account whose balance is being confirmed. */
  accountId: idSchema.optional(),
  /** Addressee, e.g. a landlord or an embassy. Defaults to the account holder. */
  addressedTo: z.string().min(1).max(120).optional(),
});

export type Statement = z.infer<typeof statementSchema>;
export type BankDocument = z.infer<typeof documentSchema>;
export type DownloadLink = z.infer<typeof downloadLinkSchema>;
export type GenerateStatementRequest = z.infer<typeof generateStatementRequestSchema>;
export type DocumentUploadRequest = z.infer<typeof documentUploadRequestSchema>;
export type IssueLetterRequest = z.infer<typeof issueLetterRequestSchema>;
