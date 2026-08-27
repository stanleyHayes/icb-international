import { STAFF_ROLES } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CONSOLE_ACCOUNTS } from '../console-accounts.js';
import { ConsoleProvisioningService } from '../console-provisioning.service.js';

const INPUT = 'a-provisioning-input';
const HASH = '$argon2id$v=19$m=65536,t=3,p=4$fake';

interface MongoUpdate {
  $set?: Record<string, unknown>;
  $setOnInsert?: Record<string, unknown>;
}

/** Captures the filter and update of every upsert so the shape of the write can be asserted. */
function fakeModel() {
  const calls: { filter: Record<string, unknown>; update: MongoUpdate }[] = [];
  return {
    calls,
    updateOne: vi.fn((filter: Record<string, unknown>, update: MongoUpdate) => {
      calls.push({ filter, update });
      return Promise.resolve({ upsertedCount: 1 });
    }),
  };
}

describe('ConsoleProvisioningService', () => {
  let credentials: ReturnType<typeof fakeModel>;
  let staff: ReturnType<typeof fakeModel>;
  let passwords: { hash: ReturnType<typeof vi.fn> };
  let service: ConsoleProvisioningService;

  beforeEach(() => {
    credentials = fakeModel();
    staff = fakeModel();
    // Deliberately does not echo the input: a fake that returned `hashed:${value}` would embed
    // the password in its own output and make the leak assertion below vacuous.
    passwords = { hash: vi.fn(() => Promise.resolve(HASH)) };
    service = new ConsoleProvisioningService(
      credentials as never,
      staff as never,
      passwords as never,
    );
  });

  it('writes both collections, because either alone leaves the account unusable', async () => {
    await service.provisionAll(INPUT);

    // A credential without a staff row signs in but is invisible to the staff directory; a staff
    // row without a credential cannot sign in at all, since the token is built from the credential.
    expect(credentials.updateOne).toHaveBeenCalledTimes(CONSOLE_ACCOUNTS.length);
    expect(staff.updateOne).toHaveBeenCalledTimes(CONSOLE_ACCOUNTS.length);
  });

  it('grants every staff role so no console section is unreachable', async () => {
    const results = await service.provisionAll(INPUT);

    for (const result of results) {
      const byName = (a: string, b: string) => a.localeCompare(b);
      expect([...result.roles].sort(byName)).toEqual([...STAFF_ROLES].sort(byName));
    }
    for (const { update } of credentials.calls) {
      expect(update.$set?.['roles']).toHaveLength(STAFF_ROLES.length);
    }
  });

  it('provisions exactly the three console addresses, lower-cased', async () => {
    const results = await service.provisionAll(INPUT);

    expect(results.map((r) => r.email)).toEqual([
      'admin@icbinternationalcommercial.com',
      'support@icbinternationalcommercial.com',
      'info@icbinternationalcommercial.com',
    ]);
  });

  it('stores a hash, never the password itself', async () => {
    await service.provisionAll(INPUT);

    for (const { update } of credentials.calls) {
      expect(update.$set?.['passwordHash']).toBe(HASH);
      expect(JSON.stringify(update)).not.toContain(INPUT);
    }
  });

  it('re-applies password and roles on a rerun so rotation takes effect', async () => {
    await service.provisionAll(INPUT);

    // $setOnInsert would leave an existing account on its old password, which would make this
    // useless as a rotation path — the fields that must change live under $set.
    for (const { update } of credentials.calls) {
      expect(Object.keys(update.$set ?? {})).toEqual(
        expect.arrayContaining(['passwordHash', 'roles', 'active', 'emailVerified']),
      );
    }
  });

  it('does not reset a name or an enrolled second factor on a rerun', async () => {
    await service.provisionAll(INPUT);

    for (const { update } of staff.calls) {
      expect(update.$set).not.toHaveProperty('mfaEnabled');
      expect(update.$set).not.toHaveProperty('firstName');
      expect(update.$setOnInsert).toHaveProperty('mfaEnabled', false);
      expect(update.$setOnInsert).toHaveProperty('mfaRequired', true);
    }
  });

  it('keys every upsert on the address so a rerun cannot duplicate an account', async () => {
    await service.provisionAll(INPUT);

    for (const { filter } of [...credentials.calls, ...staff.calls]) {
      expect(Object.keys(filter)).toEqual(['email']);
      expect(String(filter['email'])).toBe(String(filter['email']).toLowerCase());
    }
  });
});
