import { z } from 'zod';

/**
 * Staff card-operations vocabulary.
 *
 * The list/detail/limits/authorisations shapes come straight from `@icb/contracts` — a staff
 * member sees the same card a customer sees. The mutating bodies below are back-office
 * instructions with no customer-facing DTO, so they are declared here the same way the API
 * declares its staff-only schemas: composed from contract primitives, never reworded.
 */
export const CARD_PATHS = {
  list: '/admin/cards',
  detail: (cardId: string) => `/admin/cards/${cardId}`,
  issue: '/admin/cards',
  block: (cardId: string) => `/admin/cards/${cardId}/block`,
  reissue: (cardId: string) => `/admin/cards/${cardId}/reissue`,
  pinReset: (cardId: string) => `/admin/cards/${cardId}/pin-reset`,
  limits: (cardId: string) => `/admin/cards/${cardId}/limits`,
  authorisations: (cardId: string) => `/admin/cards/${cardId}/authorisations`,
  expireAuthorisation: (cardId: string, authorisationId: string) =>
    `/admin/cards/${cardId}/authorisations/${authorisationId}/expire`,
} as const;

export const CARD_STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'requested', label: 'Requested' },
  { value: 'issued', label: 'Issued' },
  { value: 'active', label: 'Active' },
  { value: 'frozen', label: 'Frozen' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' },
] as const;

export const CARD_KIND_OPTIONS = [
  { value: '', label: 'Any kind' },
  { value: 'debit', label: 'Debit' },
  { value: 'credit', label: 'Credit' },
  { value: 'virtual', label: 'Virtual' },
] as const;

const reasonSchema = z
  .string()
  .min(10, 'Give a reason of at least 10 characters — it is written to the audit trail')
  .max(500);

/** Staff block: a freeze the customer cannot lift themselves, always justified. */
export const blockCardRequestSchema = z.object({ reason: reasonSchema });

/** Staff reissue: the old PAN is retired and a replacement linked by `replacedCardId`. */
export const reissueCardRequestSchema = z.object({
  reason: z.enum(['lost', 'stolen', 'damaged', 'not_received', 'fraud']),
  detail: reasonSchema,
});

/** Force-expire an open authorisation hold rather than waiting for it to lapse. */
export const expireHoldRequestSchema = z.object({ reason: reasonSchema });

export type BlockCardRequest = z.infer<typeof blockCardRequestSchema>;
export type ReissueCardRequest = z.infer<typeof reissueCardRequestSchema>;
