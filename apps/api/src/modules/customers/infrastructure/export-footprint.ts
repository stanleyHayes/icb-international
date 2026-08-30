import type { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import type { SessionDoc, UserCredentialDoc } from './customer.schemas.js';
import type { CustomerDoc } from './customer.schemas.js';

/** A titled block of label/value rows — one per area of the customer's data. */
export interface FootprintSection {
  readonly title: string;
  readonly rows: readonly (readonly [string, string])[];
}

/** A titled table, used for the repeating parts of the footprint. */
export interface FootprintTable {
  readonly title: string;
  readonly header: readonly string[];
  readonly rows: readonly (readonly string[])[];
}

/** Everything the export document says, in the order it says it. Rendering lives elsewhere. */
export interface ExportFootprint {
  readonly title: string;
  readonly reference: string;
  readonly generatedAt: string;
  readonly sections: readonly FootprintSection[];
  readonly tables: readonly FootprintTable[];
}

export interface FootprintInput {
  readonly customer: CustomerDoc;
  /** Login metadata only — hashes and secrets never enter a footprint. */
  readonly credential: Pick<
    UserCredentialDoc,
    'emailVerified' | 'lastLoginAt'
  > | null;
  readonly sessions: readonly SessionDoc[];
  readonly accounts: readonly AccountDoc[];
  readonly generatedAt: Date;
  readonly reference: string;
}

const EMPTY_VALUE = '—';

function text(value: unknown): string {
  if (value === null || value === undefined || value === '') {
    return EMPTY_VALUE;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value) ?? EMPTY_VALUE;
}

function instant(value: Date | null | undefined): string {
  return value ? value.toISOString() : EMPTY_VALUE;
}

function bool(value: boolean): string {
  return value ? 'Yes' : 'No';
}

function flatten(record: Record<string, unknown> | null): [string, string][] {
  return Object.entries(record ?? {}).map(([key, value]) => [key, text(value)]);
}

/**
 * The customer's full footprint, normalised for rendering.
 *
 * What is deliberately *not* here matters as much as what is: no password hash, no secrets,
 * no session token — a data export must never become the thing it is meant to protect against.
 * Balances are excluded because they are ledger facts with their own export (statements), not
 * personal data.
 */
export function buildFootprint(input: FootprintInput): ExportFootprint {
  const { customer } = input;
  return {
    title: 'Personal Data Export',
    reference: input.reference,
    generatedAt: input.generatedAt.toISOString(),
    sections: [
      { title: 'Identity', rows: identityRows(customer) },
      { title: 'Individual details', rows: flatten(customer.individual) },
      { title: 'Business details', rows: flatten(customer.business) },
      { title: 'Addresses', rows: addressRows(customer) },
      { title: 'Preferences', rows: flatten(customer.preferences) },
      { title: 'Verification', rows: verificationRows(customer) },
      { title: 'Sign-in', rows: signInRows(input.credential) },
    ],
    tables: [
      { title: 'Status history', header: ['From', 'To', 'Reason', 'By', 'At'], rows: statusRows(customer) },
      { title: 'Accounts', header: ['Product', 'Number', 'IBAN', 'Currency', 'Status', 'Opened'], rows: accountRows(input.accounts) },
      { title: 'Devices & sessions', header: ['Device', 'IP', 'Last seen', 'Expires', 'Active'], rows: sessionRows(input.sessions) },
    ],
  };
}

function identityRows(customer: CustomerDoc): [string, string][] {
  return [
    ['Customer ID', customer._id],
    ['Type', customer.type],
    ['Status', customer.status],
    ['Tier', customer.tier],
    ['Email', customer.email],
    ['Phone', customer.phone],
    ['Member since', instant(customer.memberSince)],
  ];
}

function addressRows(customer: CustomerDoc): [string, string][] {
  const rows: [string, string][] = [];
  for (const [label, address] of [
    ['Residential', customer.residentialAddress],
    ['Postal', customer.postalAddress],
  ] as const) {
    rows.push([label, address ? formatAddress(address) : EMPTY_VALUE]);
  }
  return rows;
}

function formatAddress(address: {
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postalCode: string | null;
  country: string;
}): string {
  return [address.line1, address.line2, address.city, address.region, address.postalCode, address.country]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(', ');
}

function verificationRows(customer: CustomerDoc): [string, string][] {
  return [
    ['KYC status', customer.kycStatus],
    ['KYC level', text(customer.kycLevel)],
    ['Verified at', instant(customer.kycVerifiedAt)],
    ['Next review', instant(customer.kycNextReviewAt)],
    ['Risk rating', customer.riskRating],
  ];
}

function signInRows(credential: FootprintInput['credential']): [string, string][] {
  return [
    ['Email verified', bool(credential?.emailVerified ?? false)],
    ['Last sign-in', instant(credential?.lastLoginAt)],
  ];
}

function statusRows(customer: CustomerDoc): string[][] {
  return customer.statusHistory.map((change) => [
    change.from,
    change.to,
    change.reason,
    change.changedBy,
    change.changedAt.toISOString(),
  ]);
}

function accountRows(accounts: readonly AccountDoc[]): string[][] {
  return accounts.map((account) => [
    account.productName,
    account.number,
    account.iban,
    account.currency,
    account.status,
    account.openedAt.toISOString().slice(0, 10),
  ]);
}

function sessionRows(sessions: readonly SessionDoc[]): string[][] {
  return sessions.map((session) => [
    Object.entries(session.device)
      .map(([key, value]) => `${key}: ${text(value)}`)
      .join(', '),
    session.ipAddress,
    session.lastSeenAt.toISOString(),
    session.expiresAt.toISOString(),
    bool(session.revokedAt === null),
  ]);
}
