import type { StandingOrder } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { StandingOrdersService } from '../application/standing-orders.service.js';
import { StandingOrdersController } from '../standing-orders.controller.js';

const CUSTOMER_ID = 'cust-1';
const ORDER = { id: 'so-1' } as unknown as StandingOrder;

describe('StandingOrdersController', () => {
  let standingOrders: { list: ReturnType<typeof vi.fn>; cancel: ReturnType<typeof vi.fn> };
  let controller: StandingOrdersController;

  beforeEach(() => {
    standingOrders = {
      list: vi.fn().mockResolvedValue([ORDER]),
      cancel: vi.fn().mockResolvedValue(ORDER),
    };
    controller = new StandingOrdersController(standingOrders as unknown as StandingOrdersService);
  });

  it('lists the customer standing orders as a bare array', async () => {
    const result = await controller.list(CUSTOMER_ID);

    expect(standingOrders.list).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(result).toEqual([ORDER]);
  });

  it('cancels a standing order scoped by the token customer', async () => {
    const result = await controller.cancel(CUSTOMER_ID, 'so-1');

    expect(standingOrders.cancel).toHaveBeenCalledWith(CUSTOMER_ID, 'so-1');
    expect(result).toBe(ORDER);
  });
});
