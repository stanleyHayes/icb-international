import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { type UserCredentialDoc } from '../../customers/infrastructure/customer.schemas.js';
import { asAudit, frozenClock, leanQuery, mockAudit, TEST_NOW } from '../__tests__/helpers.js';
import { EMAIL_TOKEN_TTL_MS } from '../auth.constants.js';
import type { AuthMailerService } from './auth-mailer.service.js';
import { EmailVerificationService } from './email-verification.service.js';
import { PasswordService } from './password.service.js';

function setup() {
  const credentials = { updateOne: vi.fn().mockResolvedValue({}), findOne: vi.fn() };
  const mailer = { sendEmailVerification: vi.fn().mockResolvedValue(undefined) };
  const audit = mockAudit();
  const service = new EmailVerificationService(
    credentials as unknown as Model<UserCredentialDoc>,
    new PasswordService(),
    mailer as unknown as AuthMailerService,
    frozenClock(),
    asAudit(audit),
  );
  return { credentials, mailer, audit, service };
}

describe('issue', () => {
  it('stores the token hashed with a 24-hour expiry and mails the plaintext', async () => {
    const { credentials, mailer, audit, service } = setup();

    await service.issue('usr-1', 'ama@example.com');

    const [, update] = credentials.updateOne.mock.calls[0] as [
      unknown,
      { $set: { emailVerificationTokenHash: string; emailVerificationExpiresAt: Date } },
    ];
    expect(update.$set.emailVerificationTokenHash).toHaveLength(64);
    expect(update.$set.emailVerificationExpiresAt).toEqual(
      new Date(TEST_NOW.getTime() + EMAIL_TOKEN_TTL_MS),
    );
    const [to, token] = mailer.sendEmailVerification.mock.calls[0] as [string, string];
    expect(to).toBe('ama@example.com');
    expect(token.length).toBeGreaterThan(16);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.email_verification_sent' }),
    );
  });
});

describe('confirm', () => {
  const live = {
    _id: 'usr-1',
    emailVerificationExpiresAt: new Date(TEST_NOW.getTime() + 1_000),
  };

  it('verifies the address, clears the token, and audits', async () => {
    const { credentials, audit, service } = setup();
    credentials.findOne.mockReturnValue(leanQuery(live));

    await service.confirm('some-token');

    expect(credentials.updateOne).toHaveBeenCalledWith(
      { _id: 'usr-1' },
      {
        $set: {
          emailVerified: true,
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
        },
      },
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.email_verified', actorId: 'usr-1' }),
    );
  });

  it('rejects unknown and expired tokens identically', async () => {
    const { credentials, service } = setup();
    credentials.findOne.mockReturnValue(leanQuery(null));
    await expect(service.confirm('nope')).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    credentials.findOne.mockReturnValue(
      leanQuery({ _id: 'usr-1', emailVerificationExpiresAt: new Date(TEST_NOW.getTime() - 1) }),
    );
    await expect(service.confirm('late')).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(credentials.updateOne).not.toHaveBeenCalled();
  });
});
