import type { Biller, CursorPage } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BillersController } from '../billers.controller.js';
import type { BillersService } from '../billers.service.js';

const BILLER = { id: 'biller-1', name: 'City Power' } as unknown as Biller;
const PAGE: CursorPage<Biller> = { items: [BILLER], nextCursor: 'cursor-2', hasMore: true };

describe('BillersController', () => {
  let billers: { list: ReturnType<typeof vi.fn> };
  let controller: BillersController;

  beforeEach(() => {
    billers = { list: vi.fn().mockResolvedValue(PAGE) };
    controller = new BillersController(billers as unknown as BillersService);
  });

  it('delegates the directory query straight to the service — no customer scoping', async () => {
    const query = { category: 'electricity' as const, limit: 15 };

    const page = await controller.list(query);

    expect(billers.list).toHaveBeenCalledWith(query);
    expect(billers.list).toHaveBeenCalledTimes(1);
    expect(page).toBe(PAGE);
    expect(page.hasMore).toBe(true);
  });

  it('passes a filterless query through untouched', async () => {
    const query = { limit: 25 };

    await controller.list(query);

    expect(billers.list).toHaveBeenCalledWith(query);
  });
});
