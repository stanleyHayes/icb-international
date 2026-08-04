import type { ManualPostingRequest } from '@icb/contracts';
import { describe, expect, it, vi } from 'vitest';

import { ROLES_KEY } from '../../../common/decorators/roles.decorator.js';
import { NotFoundError } from '../../../common/errors/index.js';
import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import type { LedgerIntegrityService } from '../../ledger/ledger-integrity.service.js';
import { AdminController } from '../admin.controller.js';
import type { AdminService } from '../admin.service.js';
import { CustomerDirectoryController } from '../customer-directory.controller.js';
import type { CustomerDirectoryService } from '../customer-directory.service.js';
import type { ManualPostingsService } from '../manual-postings.service.js';
import { PostingsController } from '../postings.controller.js';
import { SystemHealthController } from '../system-health.controller.js';
import type { SystemHealthService } from '../system-health.service.js';

const STAFF: AccessTokenClaims = {
  sub: 'staff-1',
  customerId: null,
  email: 'ops@icb.example',
  roles: ['operations'],
  sessionId: 'sess-1',
};

describe('AdminController', () => {
  function setup() {
    const admin = {
      kpis: vi.fn().mockResolvedValue([{ id: 'kpi-1' }]),
      trialBalance: vi.fn().mockResolvedValue({ balanced: true }),
      monitor: vi.fn().mockResolvedValue([{ queue: 'eod' }]),
    };
    const integrity = { verify: vi.fn().mockResolvedValue({ ok: true }) };
    const controller = new AdminController(
      admin as unknown as AdminService,
      integrity as unknown as LedgerIntegrityService,
    );
    return { controller, admin, integrity };
  }

  it('is restricted to back-office roles', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, AdminController) as string[];

    expect(roles).toEqual(['operations', 'compliance', 'admin', 'super_admin']);
  });

  it('wraps kpis in an items envelope', async () => {
    const { controller, admin } = setup();

    const result = await controller.kpis();

    expect(admin.kpis).toHaveBeenCalledOnce();
    expect(result.items).toEqual([{ id: 'kpi-1' }]);
  });

  it('returns the trial balance as-is', async () => {
    const { controller } = setup();

    await expect(controller.trialBalance()).resolves.toEqual({ balanced: true });
  });

  it('wraps monitor entries in an items envelope', async () => {
    const { controller } = setup();

    const result = await controller.monitor();

    expect(result.items).toEqual([{ queue: 'eod' }]);
  });

  it('delegates ledger integrity to the integrity service, not the admin service', async () => {
    const { controller, integrity } = setup();

    await expect(controller.ledgerIntegrity()).resolves.toEqual({ ok: true });
    expect(integrity.verify).toHaveBeenCalledOnce();
  });
});

describe('CustomerDirectoryController', () => {
  function setup() {
    const directory = {
      search: vi.fn().mockResolvedValue({ items: [], page: 1, limit: 25, total: 0, totalPages: 0 }),
      getById: vi.fn().mockResolvedValue({ id: 'cust-1' }),
    };
    const controller = new CustomerDirectoryController(
      directory as unknown as CustomerDirectoryService,
    );
    return { controller, directory };
  }

  it('delegates the validated search query to the directory', async () => {
    const { controller, directory } = setup();
    const query = { q: 'ada', page: 1, limit: 25 };

    const page = await controller.search(query);

    expect(directory.search).toHaveBeenCalledWith(query);
    expect(page.total).toBe(0);
  });

  it('delegates a detail lookup by customer id', async () => {
    const { controller, directory } = setup();

    const view = await controller.detail('cust-1');

    expect(directory.getById).toHaveBeenCalledWith('cust-1');
    expect(view.id).toBe('cust-1');
  });

  it('propagates a not-found from the directory', async () => {
    const { controller, directory } = setup();
    directory.getById.mockRejectedValue(new NotFoundError('Customer', 'cust-9'));

    await expect(controller.detail('cust-9')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('PostingsController', () => {
  it('raises the manual posting for the token subject only', async () => {
    const manualPostings = {
      requestManualPosting: vi.fn().mockResolvedValue({ id: 'appr-1', status: 'pending' }),
    };
    const controller = new PostingsController(
      manualPostings as unknown as ManualPostingsService,
    );
    const body = { accountId: 'acct-1' } as unknown as ManualPostingRequest;

    const result = await controller.request(STAFF, body);

    expect(manualPostings.requestManualPosting).toHaveBeenCalledWith(body, 'staff-1');
    expect(result).toEqual({ id: 'appr-1', status: 'pending' });
  });

  it('is restricted to posting roles', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, PostingsController) as string[];

    expect(roles).toEqual(['operations', 'admin', 'super_admin']);
  });
});

describe('SystemHealthController', () => {
  it('returns the component health report from the service', async () => {
    const health = { check: vi.fn().mockResolvedValue({ status: 'degraded' }) };
    const controller = new SystemHealthController(health as unknown as SystemHealthService);

    await expect(controller.healthCheck()).resolves.toEqual({ status: 'degraded' });
    expect(health.check).toHaveBeenCalledOnce();
  });
});
