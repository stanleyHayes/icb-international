/* eslint-disable sonarjs/no-hardcoded-passwords -- test fixture passwords, not credentials */

import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { type UserCredentialDoc } from '../../customers/infrastructure/customer.schemas.js';
import { asAudit, leanQuery, mockAudit } from '../__tests__/helpers.js';
import { REVOKE_REASONS } from '../auth.constants.js';
import type { AuthMailerService } from './auth-mailer.service.js';
import { ChangePasswordService } from './change-password.service.js';
import type { PasswordService } from './password.service.js';
import type { SessionManagerService } from './session-manager.service.js';

const REQUEST = { currentPassword: 'OldPassword1', newPassword: 'BrandNewPass99' };

function setup() {
  const credentials = { findById: vi.fn(), updateOne: vi.fn().mockResolvedValue({}) };
  const passwords = {
    verify: vi.fn(),
    assertNotBreached: vi.fn(),
    hash: vi.fn().mockResolvedValue('$argon2id$new'),
  };
  const mailer = { sendPasswordChangedNotice: vi.fn().mockResolvedValue(undefined) };
  const sessions = { revokeAll: vi.fn().mockResolvedValue(2) };
  const audit = mockAudit();
  const service = new ChangePasswordService(
    credentials as unknown as Model<UserCredentialDoc>,
    passwords as unknown as PasswordService,
    mailer as unknown as AuthMailerService,
    sessions as unknown as SessionManagerService,
    asAudit(audit),
  );
  return { credentials, passwords, mailer, sessions, audit, service };
}

describe('change', () => {
  it('rejects a wrong current password and audits the failure', async () => {
    const { credentials, passwords, audit, service } = setup();
    credentials.findById.mockReturnValue(
      leanQuery({ _id: 'usr-1', active: true, passwordHash: '$argon2id$old', email: 'a@b.c' }),
    );
    passwords.verify.mockResolvedValue(false);

    await expect(service.change('usr-1', 'ses-1', REQUEST)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(credentials.updateOne).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.password_changed', outcome: 'failure' }),
    );
  });

  it('updates the hash and revokes every session but the current one', async () => {
    const { credentials, passwords, mailer, sessions, audit, service } = setup();
    credentials.findById.mockReturnValue(
      leanQuery({ _id: 'usr-1', active: true, passwordHash: '$argon2id$old', email: 'a@b.c' }),
    );
    passwords.verify.mockResolvedValue(true);

    await service.change('usr-1', 'ses-1', REQUEST);

    expect(passwords.assertNotBreached).toHaveBeenCalledWith(REQUEST.newPassword);
    expect(credentials.updateOne).toHaveBeenCalledWith(
      { _id: 'usr-1' },
      { $set: { passwordHash: '$argon2id$new' } },
    );
    expect(sessions.revokeAll).toHaveBeenCalledWith('usr-1', REVOKE_REASONS.PasswordChange, 'ses-1');
    expect(mailer.sendPasswordChangedNotice).toHaveBeenCalledWith('a@b.c');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.password_changed', outcome: 'success' }),
    );
  });

  it('rejects a stale principal', async () => {
    const { credentials, service } = setup();
    credentials.findById.mockReturnValue(leanQuery(null));

    await expect(service.change('usr-1', 'ses-1', REQUEST)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });
});
