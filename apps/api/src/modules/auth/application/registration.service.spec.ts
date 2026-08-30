/* eslint-disable sonarjs/no-hardcoded-passwords -- test fixture passwords, not credentials */

/* eslint-disable sonarjs/no-hardcoded-ip -- test fixture addresses, not live endpoints */

import type { RegisterRequest } from '@icb/contracts';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { type UserCredentialDoc } from '../../customers/infrastructure/customer.schemas.js';
import { asAudit, leanQuery, mockAudit } from '../__tests__/helpers.js';
import type { DeviceContext } from './auth.types.js';
import type { EmailVerificationService } from './email-verification.service.js';
import type { PasswordService } from './password.service.js';
import { RegistrationService } from './registration.service.js';
import type { UserProfileReader } from './user-profile-reader.js';

const DEVICE: DeviceContext = { deviceId: null, userAgent: 'Chrome', ipAddress: '10.0.0.1' };
const REQUEST: RegisterRequest = {
  email: 'AMA@example.com',
  password: 'BrandNewPass99',
  firstName: 'Ama',
  lastName: 'Mensah',
  phone: '+233244124521',
  acceptedTermsVersion: '2026-07',
};

const USER = {
  userId: 'usr-1',
  customerId: 'cus-1',
  email: 'ama@example.com',
  firstName: 'Ama',
  lastName: 'Mensah',
  emailVerified: false,
  roles: [],
  lastLoginAt: null,
};

function setup() {
  const credentials = { exists: vi.fn(), create: vi.fn().mockResolvedValue([{}]), findById: vi.fn() };
  const passwords = {
    assertNotBreached: vi.fn(),
    hash: vi.fn().mockResolvedValue('$argon2id$new'),
  };
  const profiles = {
    createCustomerRecord: vi.fn().mockResolvedValue(undefined),
    toAuthenticatedUser: vi.fn().mockResolvedValue(USER),
  };
  const emailVerification = { issue: vi.fn().mockResolvedValue(undefined) };
  const audit = mockAudit();
  const service = new RegistrationService(
    credentials as unknown as Model<UserCredentialDoc>,
    passwords as unknown as PasswordService,
    profiles as unknown as UserProfileReader,
    emailVerification as unknown as EmailVerificationService,
    asAudit(audit),
  );
  return { credentials, passwords, profiles, emailVerification, audit, service };
}

describe('register', () => {
  it('applies the breached-password policy first', async () => {
    const { passwords, service } = setup();
    passwords.assertNotBreached.mockImplementation(() => {
      throw new Error('breached');
    });

    await expect(service.register(REQUEST, DEVICE)).rejects.toThrow('breached');
  });

  it('rejects a duplicate email without creating anything', async () => {
    const { credentials, profiles, service } = setup();
    credentials.exists.mockResolvedValue({ _id: 'usr-0' });

    await expect(service.register(REQUEST, DEVICE)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(profiles.createCustomerRecord).not.toHaveBeenCalled();
  });

  it('creates both records, sends verification, audits, and returns the user', async () => {
    const { credentials, profiles, emailVerification, audit, service } = setup();
    credentials.exists.mockResolvedValue(null);
    credentials.findById.mockReturnValue(leanQuery({ _id: 'usr-1' }));

    const user = await service.register(REQUEST, DEVICE);

    expect(user).toEqual(USER);
    expect(profiles.createCustomerRecord).toHaveBeenCalledWith(
      expect.any(String),
      'ama@example.com',
      REQUEST,
    );
    const [rows] = credentials.create.mock.calls[0] as [Record<string, unknown>[]];
    expect(rows[0]).toMatchObject({
      email: 'ama@example.com',
      passwordHash: '$argon2id$new',
      emailVerified: false,
      active: true,
    });
    expect(emailVerification.issue).toHaveBeenCalledWith(expect.any(String), 'ama@example.com');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.register', ipAddress: '10.0.0.1' }),
    );
  });
});
