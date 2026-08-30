import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import type { AccountDoc } from '../../../accounts/infrastructure/account.schemas.js';
import type { CustomersService } from '../../customers.service.js';
import type { SessionDoc, UserCredentialDoc } from '../customer.schemas.js';
import { ExportSourceReader } from '../export-source.reader.js';
import { chainQuery, customerDoc, NOW } from '../../__tests__/fixtures.js';

function setup(credential: Record<string, unknown> | null) {
  const credentials = { findOne: vi.fn().mockReturnValue(chainQuery(credential)) };
  const sessions = { find: vi.fn().mockReturnValue(chainQuery([])) };
  const accounts = { find: vi.fn().mockReturnValue(chainQuery([])) };
  const profiles = { require: vi.fn().mockResolvedValue(customerDoc()) };

  const reader = new ExportSourceReader(
    credentials as unknown as Model<UserCredentialDoc>,
    sessions as unknown as Model<SessionDoc>,
    accounts as unknown as Model<AccountDoc>,
    profiles as unknown as CustomersService,
  );
  return { credentials, sessions, accounts, profiles, reader };
}

describe('gather', () => {
  it('reads the credential by named columns only — never the secret fields', async () => {
    const { credentials, reader } = setup({ _id: 'cred-1', emailVerified: true });

    await reader.gather('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', NOW, 'EXP-1');

    expect(credentials.findOne).toHaveBeenCalledWith({ customerId: '01J8ZCQ0R0K3M4N5P6Q7R8S9T0' });
    const chain = credentials.findOne.mock.results[0]?.value as ReturnType<typeof chainQuery>;
    expect(chain['select']).toHaveBeenCalledWith('emailVerified lastLoginAt');
  });

  it('queries sessions by the credential id, not the customer id', async () => {
    const { sessions, reader } = setup({ _id: 'cred-1', emailVerified: true });

    const input = await reader.gather('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', NOW, 'EXP-1');

    expect(sessions.find).toHaveBeenCalledWith({ userId: 'cred-1' });
    expect(input.reference).toBe('EXP-1');
    expect(input.customer._id).toBe('01J8ZCQ0R0K3M4N5P6Q7R8S9T0');
  });

  it('skips the session lookup when no credential exists', async () => {
    const { sessions, reader } = setup(null);

    const input = await reader.gather('01J8ZCQ0R0K3M4N5P6Q7R8S9T0', NOW, 'EXP-1');

    expect(sessions.find).not.toHaveBeenCalled();
    expect(input.sessions).toEqual([]);
    expect(input.credential).toBeNull();
  });
});
