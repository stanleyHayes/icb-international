import { assetRefSchema } from '@icb/contracts';
import { z } from 'zod';

/** Same ceiling the KYC and support upload minters enforce. */
const MAX_DOCUMENT_BYTES = 15 * 1024 * 1024;

const DOCUMENT_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;

/**
 * Request shapes for loan application documents.
 *
 * Defined locally rather than imported from `@icb/contracts` because the contract owners
 * publish wire schemas; these mirror the KYC upload pair until a lending contract lands.
 */
export const loanDocumentUploadRequestSchema = z.object({
  /** What the underwriter should see this as — "payslip", "bank statement". */
  label: z.string().min(1).max(120),
  filename: z.string().min(1).max(255),
  contentType: z.enum(DOCUMENT_MIME_TYPES),
  sizeBytes: z.int().positive().max(MAX_DOCUMENT_BYTES),
});

export const attachLoanDocumentRequestSchema = z.object({
  label: z.string().min(1).max(120),
  asset: assetRefSchema,
});

export type LoanDocumentUploadRequest = z.infer<typeof loanDocumentUploadRequestSchema>;
export type AttachLoanDocumentRequest = z.infer<typeof attachLoanDocumentRequestSchema>;
