/* eslint-disable sonarjs/no-hardcoded-passwords -- test fixture passwords, not credentials */

import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { type UserCredentialDoc } from '../../customers/infrastructure/customer.schemas.js';
import { asAudit, frozenClock, leanQuery, mockAudit, TEST_NOW } from '../__tests__/helpers.js';
import { DUMMY_PASSWORD_HASH, LOCKOUT_LADDER_MS, MAX_FAILED_ATTEMPTS } from '../auth.constants.js';
import { CredentialVerifier } from './credential-verifier.service.js';
import type { PasswordService } from './password.service.js';

function credential(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'usr-1',
    email: 'ama@example.com',
    passwordHash: '$argon2id$stored',
    active: true,
    failedAttempts: 0,
    lockedUntil: null,
    ...overrides,
  };
}

function setup() {
  const credentials = { findOne: vi.fn(), updateOne: vi.fn().mockResolvedValue({}) };
  const passwords = { verify: vi.fn() };
  const audit = mockAudit();
  const clock = frozenClock();
  const service = new CredentialVerifier(
    credentials as unknown as Model<UserCredentialDoc>,
    passwords as unknown as PasswordService,
    clock,
    asAudit(audit),
  );
  return { credentials, passwords, audit, clock, service };
}

describe('verify', () => {
  it('verifies a dummy hash for an unknown email so timing does not reveal it', async () => {
    const { credentials, passwords, service } = setup();
    credentials.findOne.mockReturnValue(leanQuery(null));
    passwords.verify.mockResolvedValue(false);

    await expect(service.verify('ghost@example.com', 'whatever1')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(passwords.verify).toHaveBeenCalledWith(DUMMY_PASSWORD_HASH, 'whatever1');
  });

  it('rejects a disabled account with the same outward error', async () => {
    const { credentials, passwords, service } = setup();
    credentials.findOne.mockReturnValue(leanQuery(credential({ active: false })));
    passwords.verify.mockResolvedValue(true);

    await expect(service.verify('ama@example.com', 'correct1')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('refuses a locked account and says for how long', async () => {
    const { credentials, service } = setup();
    const lockedUntil = new Date(TEST_NOW.getTime() + 30_000);
    credentials.findOne.mockReturnValue(leanQuery(credential({ lockedUntil })));

    await expect(service.verify('ama@example.com', 'correct1')).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
      retryAfterSeconds: 30,
    });
  });

  it('records and audits each failure, locking at the threshold', async () => {
    const { credentials, passwords, audit, service } = setup();
    credentials.findOne.mockReturnValue(
      leanQuery(credential({ failedAttempts: MAX_FAILED_ATTEMPTS - 1 })),
    );
    passwords.verify.mockResolvedValue(false);

    await expect(service.verify('ama@example.com', 'wrong1')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });

    const [, update] = credentials.updateOne.mock.calls[0] as [unknown, { $set: Record<string, unknown> }];
    expect(update.$set['failedAttempts']).toBe(MAX_FAILED_ATTEMPTS);
    expect(update.$set['lockedUntil']).toEqual(
      new Date(TEST_NOW.getTime() + (LOCKOUT_LADDER_MS[0] ?? 0)),
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.login_failed', outcome: 'failure' }),
    );
  });

  it('resets the failure counters on success and returns the credential', async () => {
    const { credentials, passwords, service } = setup();
    credentials.findOne.mockReturnValue(leanQuery(credential({ failedAttempts: 2 })));
    passwords.verify.mockResolvedValue(true);

    const result = await service.verify('AMA@example.com', 'correct1');

    expect(result._id).toBe('usr-1');
    const [, update] = credentials.updateOne.mock.calls[0] as [unknown, { $set: Record<string, unknown> }];
    expect(update.$set).toMatchObject({ failedAttempts: 0, lockedUntil: null });
  });

  it('normalises the email before lookup', async () => {
    const { credentials, passwords, service } = setup();
    credentials.findOne.mockReturnValue(leanQuery(credential()));
    passwords.verify.mockResolvedValue(true);

    await service.verify('  AMA@Example.com '.trim(), 'correct1');

    expect(credentials.findOne).toHaveBeenCalledWith({ email: 'ama@example.com' });
  });
});

describe('lockout ladder integration', () => {
  it('keeps the account open below the threshold', async () => {
    const { credentials, passwords, service } = setup();
    credentials.findOne.mockReturnValue(leanQuery(credential({ failedAttempts: 1 })));
    passwords.verify.mockResolvedValue(false);

    await expect(service.verify('ama@example.com', 'wrong1')).rejects.toBeDefined();

    const [, update] = credentials.updateOne.mock.calls[0] as [unknown, { $set: Record<string, unknown> }];
    expect(update.$set['lockedUntil']).toBeNull();
  });
});
