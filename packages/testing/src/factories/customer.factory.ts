import type {
  BusinessProfile,
  ContactPreferences,
  CustomerProfile,
  IndividualProfile,
} from '@icb/contracts';

import type { FactoryContext } from '../core/context.js';
import { buildAddress, phoneNumber } from './helpers.js';

const ADULT_AGE_YEARS = 30;
const INCORPORATION_YEARS_AGO = 6;
const KYC_REVIEW_YEARS = 2;

/**
 * Customer factory.
 *
 * Default: an active, KYC-approved (tier 2) individual — the state most banking flows need.
 * Pass `type: 'business'` (with no explicit `business` override) for a business customer.
 * Overrides are shallow-merged last, so any field can be pinned.
 */
export function customerProfile(
  ctx: FactoryContext,
  overrides: Partial<CustomerProfile> = {},
): CustomerProfile {
  const type = overrides.type ?? 'individual';
  const base: CustomerProfile = {
    id: ctx.nextId(),
    type,
    status: 'active',
    tier: 'standard',
    email: ctx.faker.internet.email().toLowerCase(),
    phone: phoneNumber(ctx),
    individual: type === 'individual' ? individualProfile(ctx) : null,
    business: type === 'business' ? businessProfile(ctx) : null,
    residentialAddress: buildAddress(ctx),
    postalAddress: null,
    avatar: null,
    preferences: contactPreferences(),
    kyc: {
      level: 'tier_2',
      status: 'approved',
      verifiedAt: ctx.clock.iso(),
      nextReviewAt: ctx.clock.isoPlusDays(KYC_REVIEW_YEARS * 365),
    },
    memberSince: ctx.clock.iso(),
  };
  return { ...base, ...overrides };
}

export function individualProfile(
  ctx: FactoryContext,
  overrides: Partial<IndividualProfile> = {},
): IndividualProfile {
  const base: IndividualProfile = {
    firstName: ctx.faker.person.firstName(),
    lastName: ctx.faker.person.lastName(),
    dateOfBirth: ctx.clock.datePlusDays(-ADULT_AGE_YEARS * 365),
    nationality: 'GH',
    gender: 'undisclosed',
    occupation: ctx.faker.person.jobTitle(),
  };
  return { ...base, ...overrides };
}

export function businessProfile(
  ctx: FactoryContext,
  overrides: Partial<BusinessProfile> = {},
): BusinessProfile {
  const base: BusinessProfile = {
    legalName: ctx.faker.company.name(),
    registrationNumber: `CS${ctx.digits(9)}`,
    incorporationDate: ctx.clock.datePlusDays(-INCORPORATION_YEARS_AGO * 365),
    incorporationCountry: 'GH',
    industry: ctx.faker.commerce.department(),
    employeeBand: '11_50',
  };
  return { ...base, ...overrides };
}

export function contactPreferences(
  overrides: Partial<ContactPreferences> = {},
): ContactPreferences {
  const base: ContactPreferences = {
    locale: 'en',
    timezone: 'Africa/Accra',
    marketingEmail: false,
    marketingSms: false,
    statementDelivery: 'both',
  };
  return { ...base, ...overrides };
}
