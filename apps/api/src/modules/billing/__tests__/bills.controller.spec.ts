import type {
  BillPayment,
  ConfigureAutopayRequest,
  LinkBillRequest,
  LinkedBill,
  PayBillRequest,
} from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import { BillsController } from '../bills.controller.js';
import type { BillPaymentsService } from '../bill-payments.service.js';
import type { BillsService } from '../bills.service.js';

const CUSTOMER_ID = 'cust-1';
const BILL_ID = 'bill-1';
const BILL = { id: BILL_ID, customerId: CUSTOMER_ID } as unknown as LinkedBill;
const PAYMENT = { id: 'pay-1', billId: BILL_ID } as unknown as BillPayment;

function setup() {
  const bills = {
    listForCustomer: vi.fn().mockResolvedValue([BILL]),
    link: vi.fn().mockResolvedValue(BILL),
    getForCustomer: vi.fn().mockResolvedValue(BILL),
    unlink: vi.fn().mockResolvedValue(undefined),
    configureAutopay: vi.fn().mockResolvedValue(BILL),
  };
  const payments = { pay: vi.fn().mockResolvedValue(PAYMENT) };
  const controller = new BillsController(
    bills as unknown as BillsService,
    payments as unknown as BillPaymentsService,
  );
  return { controller, bills, payments };
}

describe('BillsController', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('wraps the customer bill list in an items envelope', async () => {
    const result = await deps.controller.list(CUSTOMER_ID);

    expect(deps.bills.listForCustomer).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(result).toEqual({ items: [BILL] });
  });

  it('links a bill for the token customer', async () => {
    const body = { billerId: 'biller-1', reference: 'A-123' } as unknown as LinkBillRequest;

    const linked = await deps.controller.link(CUSTOMER_ID, body);

    expect(deps.bills.link).toHaveBeenCalledWith(CUSTOMER_ID, body);
    expect(linked).toBe(BILL);
  });

  it('delegates detail with the bill id first and the customer as the ownership filter', async () => {
    const detail = await deps.controller.detail(CUSTOMER_ID, BILL_ID);

    expect(deps.bills.getForCustomer).toHaveBeenCalledWith(BILL_ID, CUSTOMER_ID);
    expect(detail).toBe(BILL);
  });

  it('unlinks and resolves to nothing', async () => {
    const result = await deps.controller.unlink(CUSTOMER_ID, BILL_ID);

    expect(deps.bills.unlink).toHaveBeenCalledWith(BILL_ID, CUSTOMER_ID);
    expect(result).toBeUndefined();
  });

  it('configures autopay on the owned bill', async () => {
    const body = {
      enabled: true,
      fundingAccountId: 'acct-1',
    } as unknown as ConfigureAutopayRequest;

    const updated = await deps.controller.configureAutopay(CUSTOMER_ID, BILL_ID, body);

    expect(deps.bills.configureAutopay).toHaveBeenCalledWith(BILL_ID, CUSTOMER_ID, body);
    expect(updated).toBe(BILL);
  });

  it('routes a payment to the payments service with customer first', async () => {
    const body = {
      fundingAccountId: 'acct-1',
      amountMinorUnits: 5_000,
    } as unknown as PayBillRequest;

    const paid = await deps.controller.pay(CUSTOMER_ID, BILL_ID, body);

    expect(deps.payments.pay).toHaveBeenCalledWith(CUSTOMER_ID, BILL_ID, body);
    expect(paid).toBe(PAYMENT);
  });

  it('propagates a NotFoundError for a bill owned by someone else', async () => {
    deps.bills.getForCustomer.mockRejectedValue(new NotFoundError('LinkedBill', BILL_ID));

    await expect(deps.controller.detail(CUSTOMER_ID, BILL_ID)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});
