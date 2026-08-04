import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AUDIT_ACTIONS, LOGIN_HISTORY_LIMIT } from '../auth.constants.js';
import { LoginHistoryService } from './login-history.service.js';
import type { SecurityEventDoc } from '../infrastructure/auth.schemas.js';

function event(overrides: Partial<SecurityEventDoc> = {}): SecurityEventDoc {
  return {
    _id: '01JAUDIT0000000000000001',
    actorId: 'user-1',
    action: AUDIT_ACTIONS.Login,
    outcome: 'success',
    context: {},
    ipAddress: '203.0.113.10',
    userAgent: 'Firefox/141',
    previousHash: null,
    hash: 'abc',
    occurredAt: new Date('2026-08-03T09:30:00.000Z'),
    ...overrides,
  };
}

describe('LoginHistoryService', () => {
  let chain: { lean: ReturnType<typeof vi.fn> };
  let model: {
    find: ReturnType<typeof vi.fn>;
    sort: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  };
  let service: LoginHistoryService;

  beforeEach(() => {
    chain = { lean: vi.fn().mockResolvedValue([event()]) };
    model = {
      find: vi.fn().mockReturnThis(),
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnValue(chain),
    };
    service = new LoginHistoryService(model as unknown as Model<SecurityEventDoc>);
  });

  it('reads the principal’s own login actions, newest first, capped', async () => {
    await service.list('user-1');

    expect(model.find).toHaveBeenCalledWith({
      actorId: 'user-1',
      action: { $in: [AUDIT_ACTIONS.Login, AUDIT_ACTIONS.LoginFailed, AUDIT_ACTIONS.RecoveryCodeUsed] },
    });
    expect(model.sort).toHaveBeenCalledWith({ occurredAt: -1 });
    expect(model.limit).toHaveBeenCalledWith(LOGIN_HISTORY_LIMIT);
  });

  it('maps rows to the wire shape with an ISO timestamp', async () => {
    const entries = await service.list('user-1');

    expect(entries).toEqual([
      {
        id: '01JAUDIT0000000000000001',
        action: AUDIT_ACTIONS.Login,
        outcome: 'success',
        ipAddress: '203.0.113.10',
        userAgent: 'Firefox/141',
        occurredAt: '2026-08-03T09:30:00.000Z',
      },
    ]);
  });

  it('returns an empty list when the trail has nothing for the principal', async () => {
    chain.lean.mockResolvedValue([]);

    expect(await service.list('user-2')).toEqual([]);
  });
});
