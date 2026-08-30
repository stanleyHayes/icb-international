/* eslint-disable sonarjs/no-hardcoded-ip -- test fixture addresses, not live endpoints */

import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { type UserCredentialDoc } from '../../customers/infrastructure/customer.schemas.js';
import { leanQuery } from '../__tests__/helpers.js';
import type { DeviceContext } from './auth.types.js';
import { SessionIssuer } from './session-issuer.service.js';
import type { TokenService } from './token.service.js';
import type { UserProfileReader } from './user-profile-reader.js';

const DEVICE: DeviceContext = { deviceId: 'dev-1', userAgent: 'Chrome', ipAddress: '10.0.0.1' };

function setup() {
  const credentials = { findById: vi.fn() };
  const profiles = {
    recordSession: vi.fn().mockResolvedValue(undefined),
    toAuthenticatedUser: vi.fn().mockResolvedValue({ userId: 'usr-1' }),
  };
  const tokens = {
    createRefreshToken: vi.fn().mockReturnValue({
      token: 'refresh-token',
      hash: 'refresh-hash',
      expiresAt: new Date('2026-08-03T12:00:00.000Z'),
      ttlMs: 86_400_000,
    }),
    issueAccessToken: vi.fn().mockResolvedValue({ token: 'access-jwt', expiresIn: 900 }),
  };
  const service = new SessionIssuer(
    credentials as unknown as Model<UserCredentialDoc>,
    profiles as unknown as UserProfileReader,
    tokens as unknown as TokenService,
  );
  return { credentials, profiles, tokens, service };
}

const CREDENTIAL = {
  _id: 'usr-1',
  customerId: 'cus-1',
  email: 'ama@example.com',
  roles: [],
  active: true,
};

describe('issue', () => {
  it('refuses a missing or disabled credential', async () => {
    const { credentials, service } = setup();
    credentials.findById.mockReturnValue(leanQuery(null));
    await expect(service.issue('usr-1', DEVICE)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });

    credentials.findById.mockReturnValue(leanQuery({ ...CREDENTIAL, active: false }));
    await expect(service.issue('usr-1', DEVICE)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('writes the session row, then issues tokens that point at it', async () => {
    const { credentials, profiles, tokens, service } = setup();
    credentials.findById.mockReturnValue(leanQuery(CREDENTIAL));

    const issued = await service.issue('usr-1', DEVICE, { familyId: 'fam-1' });

    expect(profiles.recordSession).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'usr-1',
        familyId: 'fam-1',
        device: DEVICE,
      }),
    );
    const sessionInput = profiles.recordSession.mock.calls[0]?.[0] as { sessionId: string };
    expect(tokens.issueAccessToken).toHaveBeenCalledWith({
      sub: 'usr-1',
      customerId: 'cus-1',
      email: 'ama@example.com',
      roles: [],
      sessionId: sessionInput.sessionId,
    });
    expect(issued).toEqual({
      accessToken: 'access-jwt',
      expiresIn: 900,
      refreshToken: 'refresh-token',
      refreshTtlMs: 86_400_000,
      user: { userId: 'usr-1' },
    });
  });
});
