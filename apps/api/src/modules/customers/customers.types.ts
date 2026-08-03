import type { z } from 'zod';
import type {
  createCustomerNoteRequestSchema,
  setCustomerStatusRequestSchema,
  updatePreferencesRequestSchema,
} from '@icb/contracts';

/**
 * Request shapes the contract package exposes only as schemas. Derived here — never redeclared —
 * so a contract change flows through `z.infer` instead of drifting against a hand-written type.
 */
export type SetCustomerStatusRequest = z.infer<typeof setCustomerStatusRequestSchema>;
export type CreateCustomerNoteRequest = z.infer<typeof createCustomerNoteRequestSchema>;
export type UpdatePreferencesRequest = z.infer<typeof updatePreferencesRequestSchema>;
