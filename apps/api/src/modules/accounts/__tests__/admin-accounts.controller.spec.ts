import type { AccountDetail } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AdminAccountsController } from '../admin-accounts.controller.js';
import type { AccountStatusService } from '../application/account-status.service.js';

const ACCOUNT_ID = 'acct-1';
const DETAIL = { id: ACCOUNT_ID } as unknown as AccountDetail;

describe('AdminAccountsController', () => {
  let status: { transition: ReturnType<typeof vi.fn>; setOverdraft: ReturnType<typeof vi.fn> };
  let controller: AdminAccountsController;

  beforeEach(() => {
    status = {
      transition: vi.fn().mockResolvedValue(DETAIL),
      setOverdraft: vi.fn().mockResolvedValue(DETAIL),
    };
    controller = new AdminAccountsController(status as unknown as AccountStatusService);
  });

  it('transitions the account status with the staff-supplied reason', async () => {
    const body = { status: 'frozen', reason: 'Fraud review' };

    const result = await controller.setStatus(ACCOUNT_ID, body as never);

    expect(status.transition).toHaveBeenCalledWith(ACCOUNT_ID, 'frozen', 'Fraud review');
    expect(result).toBe(DETAIL);
  });

  it('sets the overdraft limit in minor units', async () => {
    const body = { limit: { minorUnits: 50_000, currency: 'USD', scale: 2 } };

    const result = await controller.setOverdraft(ACCOUNT_ID, body as never);

    expect(status.setOverdraft).toHaveBeenCalledWith(ACCOUNT_ID, 50_000);
    expect(result).toBe(DETAIL);
  });
});
