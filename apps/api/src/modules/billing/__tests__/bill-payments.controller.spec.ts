import type { BillPayment, CursorPage } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError } from '../../../common/errors/index.js';
import { BillPaymentsController } from '../bill-payments.controller.js';
import type { BillPaymentsService } from '../bill-payments.service.js';

const CUSTOMER_ID = 'cust-1';
const PAYMENT_ID = 'pay-1';
const PAYMENT = { id: PAYMENT_ID, customerId: CUSTOMER_ID } as unknown as BillPayment;
const PAGE: CursorPage<BillPayment> = { items: [PAYMENT], nextCursor: null, hasMore: false };

function setup() {
  const payments = {
    list: vi.fn().mockResolvedValue(PAGE),
    getForCustomer: vi.fn().mockResolvedValue(PAYMENT),
    cancel: vi.fn().mockResolvedValue(PAYMENT),
  };
  const controller = new BillPaymentsController(payments as unknown as BillPaymentsService);
  return { controller, payments };
}

describe('BillPaymentsController', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('delegates list with the token customer and validated query', async () => {
    const query = { status: ['completed' as const], limit: 20 };

    const page = await deps.controller.list(CUSTOMER_ID, query);

    expect(deps.payments.list).toHaveBeenCalledWith(CUSTOMER_ID, query);
    expect(page).toBe(PAGE);
  });

  it('delegates detail with the payment id and the owning customer', async () => {
    const detail = await deps.controller.detail(CUSTOMER_ID, PAYMENT_ID);

    expect(deps.payments.getForCustomer).toHaveBeenCalledWith(PAYMENT_ID, CUSTOMER_ID);
    expect(detail).toBe(PAYMENT);
  });

  it('delegates cancel and returns the updated payment', async () => {
    const cancelled = await deps.controller.cancel(CUSTOMER_ID, PAYMENT_ID);

    expect(deps.payments.cancel).toHaveBeenCalledWith(PAYMENT_ID, CUSTOMER_ID);
    expect(cancelled).toBe(PAYMENT);
  });

  it('propagates a ConflictError when the payment can no longer be cancelled', async () => {
    deps.payments.cancel.mockRejectedValue(new ConflictError('Payment already settled'));

    await expect(deps.controller.cancel(CUSTOMER_ID, PAYMENT_ID)).rejects.toBeInstanceOf(
      ConflictError,
    );
  });
});
