import { z } from 'zod';

import {
  customerStatusSchema,
  customerTierSchema,
  customerTypeSchema,
  kycLevelSchema,
  kycStatusSchema,
  riskRatingSchema,
} from '../common/enums.js';
import {
  addressSchema,
  assetRefSchema,
  countryCodeSchema,
  emailSchema,
  idSchema,
  isoDateSchema,
  isoDateTimeSchema,
  localeSchema,
  phoneSchema,
} from '../common/primitives.js';

export const individualProfileSchema = z.object({
  firstName: z.string().min(1).max(60),
  middleName: z.string().max(60).optional(),
  lastName: z.string().min(1).max(60),
  dateOfBirth: isoDateSchema,
  nationality: countryCodeSchema,
  gender: z.enum(['male', 'female', 'other', 'undisclosed']).optional(),
  occupation: z.string().max(80).optional(),
  employer: z.string().max(120).optional(),
  annualIncomeBand: z
    .enum(['under_25k', '25k_50k', '50k_100k', '100k_250k', 'over_250k'])
    .optional(),
});

export const businessProfileSchema = z.object({
  legalName: z.string().min(1).max(160),
  tradingName: z.string().max(160).optional(),
  registrationNumber: z.string().min(1).max(60),
  incorporationDate: isoDateSchema,
  incorporationCountry: countryCodeSchema,
  industry: z.string().max(120),
  employeeBand: z.enum(['1_10', '11_50', '51_250', '251_1000', 'over_1000']).optional(),
  annualTurnoverBand: z.enum(['under_100k', '100k_1m', '1m_10m', 'over_10m']).optional(),
  website: z.url().optional(),
});

export const contactPreferencesSchema = z.object({
  locale: localeSchema.default('en'),
  timezone: z.string().max(64).default('UTC'),
  marketingEmail: z.boolean().default(false),
  marketingSms: z.boolean().default(false),
  statementDelivery: z.enum(['email', 'in_app', 'both']).default('both'),
});

/** The customer as the customer themselves sees it. */
export const customerProfileSchema = z.object({
  id: idSchema,
  type: customerTypeSchema,
  status: customerStatusSchema,
  tier: customerTierSchema,
  email: emailSchema,
  phone: phoneSchema,
  individual: individualProfileSchema.nullable(),
  business: businessProfileSchema.nullable(),
  residentialAddress: addressSchema.nullable(),
  postalAddress: addressSchema.nullable(),
  avatar: assetRefSchema.nullable(),
  preferences: contactPreferencesSchema,
  kyc: z.object({
    level: kycLevelSchema.nullable(),
    status: kycStatusSchema,
    verifiedAt: isoDateTimeSchema.nullable(),
    nextReviewAt: isoDateTimeSchema.nullable(),
  }),
  memberSince: isoDateTimeSchema,
});

/** The same customer as back-office staff see them: adds risk, flags and internal notes. */
export const customerAdminViewSchema = customerProfileSchema.extend({
  riskRating: riskRatingSchema,
  flags: z.array(
    z.object({
      code: z.string(),
      label: z.string(),
      severity: z.enum(['info', 'warning', 'critical']),
      raisedAt: isoDateTimeSchema,
      raisedBy: z.string(),
    }),
  ),
  relationshipManager: z.string().nullable(),
  totalRelationshipValue: z.object({ minorUnits: z.int(), currency: z.string(), scale: z.int() }),
  accountCount: z.int().nonnegative(),
  lastActivityAt: isoDateTimeSchema.nullable(),
  internalNotes: z.int().nonnegative().describe('Count of notes; fetched separately'),
});

export const updateProfileRequestSchema = z.object({
  phone: phoneSchema.optional(),
  residentialAddress: addressSchema.optional(),
  postalAddress: addressSchema.nullable().optional(),
  individual: individualProfileSchema.partial().optional(),
  business: businessProfileSchema.partial().optional(),
});

export const updatePreferencesRequestSchema = contactPreferencesSchema.partial();

export const customerSearchQuerySchema = z.object({
  q: z.string().min(2).max(120).optional(),
  status: customerStatusSchema.optional(),
  tier: customerTierSchema.optional(),
  riskRating: riskRatingSchema.optional(),
  kycStatus: kycStatusSchema.optional(),
});

export const customerNoteSchema = z.object({
  id: idSchema,
  customerId: idSchema,
  body: z.string().min(1).max(4000),
  authorId: idSchema,
  authorName: z.string(),
  pinned: z.boolean(),
  createdAt: isoDateTimeSchema,
});

export const createCustomerNoteRequestSchema = z.object({
  body: z.string().min(1).max(4000),
  pinned: z.boolean().default(false),
});

export const setCustomerStatusRequestSchema = z.object({
  status: customerStatusSchema,
  reason: z.string().min(4).max(500),
});

export type IndividualProfile = z.infer<typeof individualProfileSchema>;
export type BusinessProfile = z.infer<typeof businessProfileSchema>;
export type ContactPreferences = z.infer<typeof contactPreferencesSchema>;
export type CustomerProfile = z.infer<typeof customerProfileSchema>;
export type CustomerAdminView = z.infer<typeof customerAdminViewSchema>;
export type UpdateProfileRequest = z.infer<typeof updateProfileRequestSchema>;
export type CustomerSearchQuery = z.infer<typeof customerSearchQuerySchema>;
export type CustomerNote = z.infer<typeof customerNoteSchema>;
