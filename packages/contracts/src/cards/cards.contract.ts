import { z } from 'zod';

import {
  cardChannelSchema,
  cardKindSchema,
  cardNetworkSchema,
  cardStatusSchema,
} from '../common/enums.js';
import { cursorQuerySchema } from '../common/pagination.js';
import {
  countryCodeSchema,
  idSchema,
  isoDateTimeSchema,
  moneySchema,
  positiveMoneySchema,
} from '../common/primitives.js';
import { transactionCategorySchema } from '../transactions/transactions.contract.js';

/**
 * Card controls.
 *
 * Every switch here is enforced server-side during authorisation, not merely displayed. A
 * control the customer can see but that does not actually decline a transaction is worse than
 * no control at all.
 */
export const cardControlsSchema = z.object({
  channels: z.record(cardChannelSchema, z.boolean()),
  blockedCategories: z.array(transactionCategorySchema),
  allowedCountries: z.array(countryCodeSchema).nullable(),
});

export const cardLimitsSchema = z.object({
  perTransaction: moneySchema,
  daily: moneySchema,
  monthly: moneySchema,
  atmDaily: moneySchema,
  contactless: moneySchema,
});

export const cardSpendSchema = z.object({
  todaySpent: moneySchema,
  monthSpent: moneySchema,
  dailyRemaining: moneySchema,
  monthlyRemaining: moneySchema,
});

export const cardSummarySchema = z.object({
  id: idSchema,
  accountId: idSchema,
  kind: cardKindSchema,
  network: cardNetworkSchema,
  status: cardStatusSchema,
  nickname: z.string().max(60).nullable(),
  cardholderName: z.string(),
  panLast4: z.string().length(4),
  expiryMonth: z.int().min(1).max(12),
  expiryYear: z.int().min(2000).max(2100),
  frozen: z.boolean(),
  contactlessEnabled: z.boolean(),
  issuedAt: isoDateTimeSchema,
});

export const cardDetailSchema = cardSummarySchema.extend({
  controls: cardControlsSchema,
  limits: cardLimitsSchema,
  spend: cardSpendSchema,
  pinSet: z.boolean(),
  activatedAt: isoDateTimeSchema.nullable(),
  replacedCardId: idSchema.nullable(),
  travelNoticeUntil: isoDateTimeSchema.nullable(),
});

/**
 * The full PAN. Returned only to the authenticated cardholder, never logged, never cached, and
 * accompanied by the deadline after which the UI must stop displaying it.
 */
export const cardSensitiveDetailsSchema = z.object({
  pan: z.string().regex(/^\d{16}$/),
  cvv: z.string().regex(/^\d{3,4}$/),
  expiryMonth: z.int().min(1).max(12),
  expiryYear: z.int(),
  cardholderName: z.string(),
  hideAfter: isoDateTimeSchema,
});

export const issueCardRequestSchema = z.object({
  accountId: idSchema,
  kind: cardKindSchema,
  network: cardNetworkSchema.default('visa'),
  nickname: z.string().max(60).optional(),
  deliveryAddressId: z.enum(['residential', 'postal']).default('residential'),
});

export const updateCardRequestSchema = z.object({
  nickname: z.string().max(60).nullable().optional(),
  frozen: z.boolean().optional(),
  contactlessEnabled: z.boolean().optional(),
});

export const updateCardControlsRequestSchema = z.object({
  channels: z.record(cardChannelSchema, z.boolean()).optional(),
  blockedCategories: z.array(transactionCategorySchema).optional(),
  allowedCountries: z.array(countryCodeSchema).nullable().optional(),
});

export const updateCardLimitsRequestSchema = z.object({
  perTransaction: positiveMoneySchema.optional(),
  daily: positiveMoneySchema.optional(),
  monthly: positiveMoneySchema.optional(),
  atmDaily: positiveMoneySchema.optional(),
  contactless: positiveMoneySchema.optional(),
});

export const setCardPinRequestSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN must be four digits'),
});

export const reportCardRequestSchema = z.object({
  reason: z.enum(['lost', 'stolen', 'damaged', 'not_received', 'fraud']),
  detail: z.string().max(500).optional(),
  reissue: z.boolean().default(true),
});

export const travelNoticeRequestSchema = z.object({
  countries: z.array(countryCodeSchema).min(1).max(20),
  from: z.iso.date(),
  to: z.iso.date(),
});

/** One authorisation event as returned by the simulated card network. */
export const cardAuthorisationSchema = z.object({
  id: idSchema,
  cardId: idSchema,
  merchantName: z.string(),
  mcc: z.string().length(4),
  amount: moneySchema,
  billingAmount: moneySchema,
  status: z.enum(['approved', 'declined', 'reversed', 'captured', 'expired']),
  declineReason: z.string().nullable(),
  channel: cardChannelSchema,
  country: countryCodeSchema.nullable(),
  /** Acquirer reference number — the identifier a dispute is raised against. */
  arn: z.string().nullable(),
  authorisedAt: isoDateTimeSchema,
  capturedAt: isoDateTimeSchema.nullable(),
});

export const cardQuerySchema = cursorQuerySchema.extend({
  accountId: idSchema.optional(),
  status: z.array(cardStatusSchema).optional(),
  kind: z.array(cardKindSchema).optional(),
});

// ---- Staff card operations (the `/admin/cards` surface) ---------------------

/**
 * A staff justification, always written to the audit trail. Shared by every staff action
 * below — a freeze the customer cannot lift themselves is never made without one.
 */
const staffReasonSchema = z
  .string()
  .min(10, 'Give a reason of at least 10 characters — it is written to the audit trail')
  .max(500);

/** Staff block: a freeze the customer cannot lift themselves, always justified. */
export const blockCardRequestSchema = z.object({ reason: staffReasonSchema });

/** Staff reissue: the old PAN is retired and a replacement linked by `replacedCardId`. */
export const reissueCardRequestSchema = z.object({
  reason: z.enum(['lost', 'stolen', 'damaged', 'not_received', 'fraud']),
  detail: staffReasonSchema,
});

/** Force-expire an open authorisation hold rather than waiting for it to lapse. */
export const expireHoldRequestSchema = z.object({ reason: staffReasonSchema });

export type CardSummary = z.infer<typeof cardSummarySchema>;
export type CardDetail = z.infer<typeof cardDetailSchema>;
export type CardSensitiveDetails = z.infer<typeof cardSensitiveDetailsSchema>;
export type CardControls = z.infer<typeof cardControlsSchema>;
export type CardLimits = z.infer<typeof cardLimitsSchema>;
export type IssueCardRequest = z.infer<typeof issueCardRequestSchema>;
export type ReportCardRequest = z.infer<typeof reportCardRequestSchema>;
export type CardAuthorisation = z.infer<typeof cardAuthorisationSchema>;
export type BlockCardRequest = z.infer<typeof blockCardRequestSchema>;
export type ReissueCardRequest = z.infer<typeof reissueCardRequestSchema>;
export type ExpireHoldRequest = z.infer<typeof expireHoldRequestSchema>;
