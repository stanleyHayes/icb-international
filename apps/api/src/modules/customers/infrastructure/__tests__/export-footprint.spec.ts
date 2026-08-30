import { describe, expect, it } from 'vitest';

import type { AccountDoc } from '../../../accounts/infrastructure/account.schemas.js';
import { buildFootprint } from '../export-footprint.js';
import type { SessionDoc } from '../customer.schemas.js';
import { customerDoc, NOW } from '../../__tests__/fixtures.js';

function account(overrides: Record<string, unknown> = {}): AccountDoc {
  return {
    _id: 'acct-1',
    productName: 'Everyday Current',
    number: '1002003004',
    iban: 'GH29ICB01002003004',
    currency: 'USD',
    status: 'active',
    openedAt: NOW,
    ...overrides,
  } as AccountDoc;
}

function session(overrides: Record<string, unknown> = {}): SessionDoc {
  return {
    _id: 'sess-1',
    device: { label: 'Safari on macOS' },
    ipAddress: '127.0.0.1',
    lastSeenAt: NOW,
    expiresAt: NOW,
    revokedAt: null,
    ...overrides,
  } as unknown as SessionDoc;
}

function build(overrides: Partial<Parameters<typeof buildFootprint>[0]> = {}) {
  return buildFootprint({
    customer: customerDoc(),
    credential: { emailVerified: true, lastLoginAt: NOW },
    sessions: [session()],
    accounts: [account()],
    generatedAt: NOW,
    reference: 'EXP-TEST',
    ...overrides,
  });
}

describe('buildFootprint', () => {
  it('carries the identity and verification facts', () => {
    const footprint = build();
    const identity = footprint.sections.find((s) => s.title === 'Identity');
    const verification = footprint.sections.find((s) => s.title === 'Verification');

    expect(identity?.rows).toContainEqual(['Customer ID', '01J8ZCQ0R0K3M4N5P6Q7R8S9T0']);
    expect(identity?.rows).toContainEqual(['Email', 'ama@example.com']);
    expect(verification?.rows).toContainEqual(['KYC status', 'approved']);
  });

  it('lists accounts and sessions as tables', () => {
    const footprint = build();
    const accounts = footprint.tables.find((t) => t.title === 'Accounts');
    const sessions = footprint.tables.find((t) => t.title === 'Devices & sessions');

    expect(accounts?.rows[0]).toContain('1002003004');
    expect(sessions?.rows[0]).toContain('127.0.0.1');
    expect(sessions?.rows[0]?.at(-1)).toBe('Yes');
  });

  it('marks a revoked session as inactive', () => {
    const footprint = build({ sessions: [session({ revokedAt: NOW })] });
    const sessions = footprint.tables.find((t) => t.title === 'Devices & sessions');
    expect(sessions?.rows[0]?.at(-1)).toBe('No');
  });

  it('includes the lifecycle history when transitions exist', () => {
    const customer = customerDoc({
      statusHistory: [
        { from: 'active', to: 'suspended', reason: 'Fraud review', changedBy: 'ops', changedAt: NOW },
      ],
    });
    const footprint = build({ customer });
    const history = footprint.tables.find((t) => t.title === 'Status history');

    expect(history?.rows[0]).toEqual([
      'active',
      'suspended',
      'Fraud review',
      'ops',
      NOW.toISOString(),
    ]);
  });

  it('handles a credential-less customer without inventing sign-in facts', () => {
    const footprint = build({ credential: null });
    const signIn = footprint.sections.find((s) => s.title === 'Sign-in');

    expect(signIn?.rows).toContainEqual(['Email verified', 'No']);
    expect(signIn?.rows).toContainEqual(['Last sign-in', '—']);
  });
});
