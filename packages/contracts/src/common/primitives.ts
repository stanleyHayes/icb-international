import { CURRENCY_CODES } from '@icb/money';
import { z } from 'zod';

/**
 * Primitive schemas shared by every bounded context.
 *
 * Anything that appears in more than one context belongs here, so that a change to (say) how an
 * identifier is validated happens in exactly one place.
 */

/** ULID — 26 chars, Crockford base32, lexicographically sortable. Every `_id` in ICB. */
export const idSchema = z
  .string()
  .regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, 'Expected a ULID identifier')
  .describe('ULID identifier');

export const emailSchema = z.email().toLowerCase().max(254);

/** E.164. Stored normalised so that the same phone is never two records. */
export const phoneSchema = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Expected an E.164 phone number, e.g. +233201234567');

export const isoDateTimeSchema = z.iso.datetime({ offset: true }).describe('ISO 8601 instant');
export const isoDateSchema = z.iso.date().describe('ISO 8601 calendar date (YYYY-MM-DD)');

export const currencySchema = z.enum(CURRENCY_CODES);

/**
 * Money on the wire.
 *
 * `scale` is redundant with `currency` but is sent anyway: it lets a client format correctly
 * without shipping the whole currency table, and it makes a malformed payload obvious.
 */
export const moneySchema = z
  .object({
    minorUnits: z.int(),
    currency: currencySchema,
    scale: z.int().min(0).max(4),
  })
  .describe('A monetary amount in integer minor units');

export type MoneyDto = z.infer<typeof moneySchema>;

/** A positive amount, for anything a customer initiates. Zero-value transfers are rejected. */
export const positiveMoneySchema = moneySchema.refine((value) => value.minorUnits > 0, {
  error: 'Amount must be greater than zero',
});

export const countryCodeSchema = z
  .string()
  .length(2)
  .regex(/^[A-Z]{2}$/, 'Expected an ISO 3166-1 alpha-2 country code');

export const localeSchema = z
  .string()
  .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Expected a BCP 47 language tag such as en or en-GB');

export const addressSchema = z.object({
  line1: z.string().min(1).max(120),
  line2: z.string().max(120).optional(),
  city: z.string().min(1).max(80),
  region: z.string().max(80).optional(),
  postalCode: z.string().max(20).optional(),
  country: countryCodeSchema,
});

export type Address = z.infer<typeof addressSchema>;

/** A stored asset (Cloudinary public id + delivery metadata). Never a raw URL in the database. */
export const assetRefSchema = z.object({
  provider: z.literal('cloudinary'),
  publicId: z.string().min(1).max(255),
  resourceType: z.enum(['image', 'raw', 'video']),
  format: z.string().max(10).optional(),
  bytes: z.int().nonnegative().optional(),
  originalFilename: z.string().max(255).optional(),
  uploadedAt: isoDateTimeSchema,
});

export type AssetRef = z.infer<typeof assetRefSchema>;

/** Free-form metadata attached to domain records. Bounded so it cannot become a dumping ground. */
export const metadataSchema = z.record(z.string().max(40), z.string().max(500)).optional();

/** An idempotency key supplied by the client on every mutating money endpoint. */
export const idempotencyKeySchema = z.string().min(8).max(128);
