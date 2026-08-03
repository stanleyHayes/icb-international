import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { AmlAlertsService } from '../application/aml-alerts.service.js';
import type { MonitoringContextService } from '../application/monitoring-context.service.js';
import { AmlMonitoringService } from '../application/monitoring.service.js';
import { AmlScreeningService } from '../application/screening.service.js';
import type { FlowPoint } from '../domain/scenario.types.js';
import type { AmlAlertDoc } from '../infrastructure/aml-alert.schemas.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const DAY = 86_400_000;

/** The first fabricated sanctions entry on the kyc watchlist — an exact-match name. */
const LISTED_NAME = 'Viktor Anatoly Rusanov';

function customerDoc(firstName: string, lastName: string): CustomerDoc {
  return {
    _id: 'cust-1',
    type: 'individual',
    email: 'customer@example.com',
    individual: { firstName, lastName },
  } as unknown as CustomerDoc;
}

function leanable(value: unknown) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

function alertModelMock() {
  return {
    findOne: vi.fn().mockReturnValue(leanable(null)),
    create: vi.fn((docs: unknown[]) => Promise.resolve(docs)),
  };
}

function customersModelMock(customer: CustomerDoc | null) {
  return { findById: vi.fn().mockReturnValue(leanable(customer)) };
}

function alertsService(model: ReturnType<typeof alertModelMock>): AmlAlertsService {
  const clock = new ClockService();
  clock.freeze(NOW);
  return new AmlAlertsService(model as unknown as Model<AmlAlertDoc>, clock);
}

describe('AmlScreeningService', () => {
  let alertModel: ReturnType<typeof alertModelMock>;
  let screening: AmlScreeningService;
  let customers: ReturnType<typeof customersModelMock>;

  beforeEach(() => {
    alertModel = alertModelMock();
    customers = customersModelMock(customerDoc('Viktor Anatoly', 'Rusanov'));
    screening = new AmlScreeningService(
      customers as unknown as Model<CustomerDoc>,
      alertsService(alertModel),
    );
  });

  it('raises a critical sanctions alert for a listed customer name', async () => {
    const raised = await screening.screenCustomer('cust-1');

    expect(raised).toHaveLength(1);
    expect(raised[0]?.kind).toBe('sanctions_match');
    expect(raised[0]?.severity).toBe('critical');
    expect(raised[0]?.matchScore).toBe(1);
    expect(raised[0]?.matchDetail).toContain('ICB-SIM-NPWMD');
  });

  it('raises nothing for a clean name', async () => {
    customers.findById.mockReturnValue(leanable(customerDoc('Amara', 'Mensah')));

    const raised = await screening.screenCustomer('cust-1');

    expect(raised).toHaveLength(0);
    expect(alertModel.create).not.toHaveBeenCalled();
  });

  it('screens a counterparty but attaches the alert to our customer', async () => {
    customers.findById.mockReturnValue(leanable(customerDoc('Amara', 'Mensah')));

    const raised = await screening.screenCounterparty('cust-1', LISTED_NAME);

    expect(raised).toHaveLength(1);
    expect(raised[0]?.customerName).toBe('Amara Mensah');
    expect(raised[0]?.matchDetail).toContain(`counterparty "${LISTED_NAME}"`);
  });

  it('fails loudly when the customer does not exist', async () => {
    customers.findById.mockReturnValue(leanable(null));

    await expect(screening.screenCustomer('ghost')).rejects.toThrow(NotFoundError);
  });
});

describe('AmlMonitoringService', () => {
  let alertModel: ReturnType<typeof alertModelMock>;
  let context: { flowsFor: ReturnType<typeof vi.fn> };
  let monitoring: AmlMonitoringService;

  function structuringFlows(): FlowPoint[] {
    return [1, 2, 3].map((index) => ({
      transactionId: `txn-${index}`,
      direction: 'credit',
      minorUnits: 900_000,
      currency: 'USD',
      transactionType: 'deposit',
      at: new Date(NOW.getTime() - index * DAY),
      destinationCountry: null,
      counterpartyName: null,
    }));
  }

  beforeEach(() => {
    alertModel = alertModelMock();
    context = { flowsFor: vi.fn().mockResolvedValue(structuringFlows()) };
    const clock = new ClockService();
    clock.freeze(NOW);
    monitoring = new AmlMonitoringService(
      customersModelMock(customerDoc('Amara', 'Mensah')) as unknown as Model<CustomerDoc>,
      context as unknown as MonitoringContextService,
      alertsService(alertModel),
      clock,
    );
  });

  it('raises an alert when a scenario fires on the scan', async () => {
    const raised = await monitoring.scanCustomer('cust-1');

    expect(raised).toHaveLength(1);
    expect(raised[0]?.kind).toBe('structuring');
    expect(raised[0]?.customerName).toBe('Amara Mensah');
  });

  it('returns nothing when the customer has no recent flows', async () => {
    context.flowsFor.mockResolvedValue([]);

    const raised = await monitoring.scanCustomer('cust-1');

    expect(raised).toHaveLength(0);
    expect(alertModel.create).not.toHaveBeenCalled();
  });

  it('does not raise a second alert for a pattern already being worked', async () => {
    alertModel.findOne.mockReturnValue(leanable({ _id: 'existing' }));

    const raised = await monitoring.scanCustomer('cust-1');

    expect(raised).toHaveLength(0);
    expect(alertModel.create).not.toHaveBeenCalled();
  });

  it('fails loudly when the customer does not exist', async () => {
    const clock = new ClockService();
    const missing = new AmlMonitoringService(
      customersModelMock(null) as unknown as Model<CustomerDoc>,
      context as unknown as MonitoringContextService,
      alertsService(alertModel),
      clock,
    );

    await expect(missing.scanCustomer('ghost')).rejects.toThrow(NotFoundError);
  });
});
