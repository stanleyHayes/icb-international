import { DEFAULT_EPOCH_ISO, mintTestAccessJwt } from '@icb/testing';
import type { Connection } from 'mongoose';

import { newId } from '../../../src/infrastructure/database/identifier.js';

/** Fixed instant for every seeded timestamp — no test reads the host clock (agent_plan.md N8). */
export const FIXED_NOW = new Date(DEFAULT_EPOCH_ISO);

export interface TestIdentity {
  readonly userId: string;
  readonly customerId: string | null;
  readonly email: string;
  readonly roles: readonly string[];
  readonly accessToken: string;
}

interface SeedCustomerOptions {
  readonly email: string;
  readonly firstName: string;
  readonly lastName: string;
}

/**
 * Insert an active, fully-verified customer plus login credential straight into Mongo — the
 * same shape `SeedIdentityService.createPersona` writes. Returns the identity with a minted
 * access token; the API's guard validates the JWT alone, so no session row is needed.
 */
export async function seedCustomer(
  connection: Connection,
  options: SeedCustomerOptions,
): Promise<TestIdentity> {
  const userId = newId();
  const customerId = newId();
  await connection.collection('customers').insertOne(customerDocument(customerId, options));
  await connection.collection('user_credentials').insertOne(credentialDocument(userId, customerId, options.email));
  return { userId, customerId, email: options.email, roles: [], accessToken: accessToken(userId, customerId, options.email, []) };
}

/** A staff principal: no customerId, roles from the JWT alone — no DB rows required. */
export function staffIdentity(roles: readonly string[], tag: string): TestIdentity {
  const userId = newId();
  const email = `${tag}@staff.sec02.test`;
  return { userId, customerId: null, email, roles, accessToken: accessToken(userId, null, email, roles) };
}

function accessToken(userId: string, customerId: string | null, email: string, roles: readonly string[]): string {
  const secret = process.env['JWT_ACCESS_SECRET'];
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET is not set; the API under test would refuse to boot too.');
  }
  return mintTestAccessJwt({
    secret,
    claims: { sub: userId, customerId, email, roles: [...roles], sessionId: newId() },
  });
}

function customerDocument(customerId: string, options: SeedCustomerOptions): Record<string, unknown> {
  return {
    _id: customerId,
    type: 'individual',
    status: 'active',
    tier: 'standard',
    email: options.email,
    phone: '+233200000000',
    individual: { firstName: options.firstName, lastName: options.lastName, nationality: 'GH' },
    business: null,
    residentialAddress: {
      line1: '1 Harbour Road',
      line2: null,
      city: 'Accra',
      region: null,
      postalCode: null,
      country: 'GH',
    },
    postalAddress: null,
    preferences: {
      locale: 'en',
      timezone: 'UTC',
      marketingEmail: false,
      marketingSms: false,
      statementDelivery: 'both',
    },
    kycLevel: 'tier_3',
    kycStatus: 'approved',
    kycVerifiedAt: FIXED_NOW,
    riskRating: 'low',
    memberSince: FIXED_NOW,
  };
}

function credentialDocument(userId: string, customerId: string, email: string): Record<string, unknown> {
  return {
    _id: userId,
    customerId,
    email,
    // eslint-disable-next-line sonarjs/no-hardcoded-passwords -- inert placeholder, never authenticated against: these identities use minted JWTs
    passwordHash: '$argon2id$sec02-unused-password-hash',
    emailVerified: true,
    failedAttempts: 0,
    lockedUntil: null,
    lastLoginAt: null,
    roles: [],
    active: true,
  };
}
