import type { CreateTransferRequest } from '@icb/contracts';
import type { ClientSession } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { InsufficientFundsError, LimitExceededError } from '../../../../common/errors/index.js';
import { ClockService } from '../../../../simulation/clock/clock.service.js';
import { TransferBlockedError } from '../../domain/transfer-errors.js';
import { TRANSFER_EVENTS } from '../../domain/transfers.constants.js';
import { DestinationResolver } from '../destination-resolver.js';
import type { FraudCheckPort } from '../fraud-check.port.js';
import { TransferOrchestrator } from '../transfer-orchestrator.js';
import { TransferPreparationService } from '../transfer-preparation.service.js';
import type { TransferExecution } from '../transfer-pipeline.types.js';
import type { RailTransferUseCase } from '../use-cases/rail-transfer.use-case.js';
import { metricsStub } from '../../../../common/observability/__tests__/metrics.stub.js';

const NOW = new Date('2026-08-03T10:00:00.000Z');
const session = { id: 'txn' } as unknown as ClientSession;

const BENEFICIARY_DOC = {
  _id: 'ben-1',
  destination: {
    kind: 'domestic_bank',
    accountNumber: '12345678',
    sortCode: '12-34-56',
    accountHolderName: 'Jane Doe',
  },
  nickname: null,
  name: 'Jane Doe',
  displayIdentifier: '•••• 5678',
};

function request(overrides: Partial<CreateTransferRequest> = {}): CreateTransferRequest {
  return {
    fromAccountId: 'acct-1',
    destination: { kind: 'beneficiary', beneficiaryId: 'ben-1' },
    amount: { minorUnits: 10_000, currency: 'GBP', scale: 2 },
    saveBeneficiary: false,
    ...overrides,
  };
}

function setup(order: string[]) {
  const source = { _id: 'acct-1', number: '0000000001', currency: 'GBP', nickname: null };
  const model = {
    aggregate: vi.fn().mockImplementation(() => {
      order.push('limits.daily');
      return Promise.resolve([{ total: 0 }]);
    }),
    create: vi.fn().mockImplementation((rows: unknown[]) => {
      order.push('record');
      return Promise.resolve(rows);
    }),
  };
  const accounts = {
    loadSpendable: vi.fn().mockImplementation(() => {
      order.push('validate');
      return Promise.resolve(source);
    }),
    balancesFor: vi.fn().mockImplementation(() => {
      order.push('funds');
      return Promise.resolve({
        available: { minorUnits: 1_000_000, currency: 'GBP' },
      });
    }),
    findByNumber: vi.fn(),
  };
  const beneficiaries = {
    loadOwned: vi.fn().mockResolvedValue(BENEFICIARY_DOC),
    assertUsable: vi.fn().mockImplementation(() => {
      order.push('beneficiary');
      return Promise.resolve(BENEFICIARY_DOC);
    }),
    create: vi.fn(),
  };
  const fraudCheck = vi.fn().mockImplementation(() => {
    order.push('fraud');
    return Promise.resolve({ decision: 'allow', assessmentId: 'risk-1' });
  });
  const fraud: FraudCheckPort = { check: fraudCheck };
  const execution: TransferExecution = {
    transactionId: 'txn-1',
    status: 'in_settlement',
    ledgerStatus: 'authorised',
    estimatedArrival: NOW,
    railReference: 'TRACE-1',
    detail: null,
  };
  const executeMock = vi.fn().mockImplementation(() => {
    order.push('useCase');
    return Promise.resolve(execution);
  });
  const useCase: RailTransferUseCase = { rail: 'ach', execute: executeMock };
  const standingOrders = { plan: vi.fn(), advance: vi.fn() };
  const transactionManager = {
    withTransaction: vi.fn().mockImplementation((cb: (s: ClientSession) => unknown) => cb(session)),
  };
  const outbox = {
    publish: vi.fn().mockImplementation(() => {
      order.push('notify');
      return Promise.resolve('evt-1');
    }),
  };
  const clock = new ClockService();
  clock.freeze(NOW);

  const destinations = new DestinationResolver(beneficiaries as never, accounts as never);
  const preparation = new TransferPreparationService(
    model as never,
    accounts as never,
    destinations,
    { confirm: vi.fn(), assertHighValueStepUp: vi.fn().mockResolvedValue(undefined) } as never,
    fraud,
    clock,
  );
  const orchestrator = new TransferOrchestrator(
    model as never,
    preparation,
    [useCase],
    standingOrders as never,
    transactionManager as never,
    outbox as never,
    metricsStub(),
  );
  return { model, accounts, beneficiaries, fraud, fraudCheck, useCase, executeMock, standingOrders, outbox, orchestrator };
}

describe('pipeline order', () => {
  let order: string[];
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    order = [];
    context = setup(order);
  });

  it('runs validate → limits → beneficiary → fraud → funds → use-case → record → notify', async () => {
    await context.orchestrator.initiate('cust-1', request());

    expect(order).toEqual([
      'validate',
      'limits.daily',
      'beneficiary',
      'fraud',
      'funds',
      'useCase',
      'record',
      'notify',
    ]);
  });

  it('hands the rail use-case the prepared terms', async () => {
    await context.orchestrator.initiate('cust-1', request());

    const [prepared] = context.executeMock.mock.calls[0] as [
      { rail: string; debit: { minorUnits: number }; beneficiaryId?: string },
    ];
    expect(prepared.rail).toBe('ach');
    expect(prepared.debit.minorUnits).toBe(10_000);
  });

  it('stops at a fraud block: nothing posts, nothing is recorded', async () => {
    context.fraudCheck.mockResolvedValue({
      decision: 'block',
      assessmentId: 'risk-9',
    });

    await expect(context.orchestrator.initiate('cust-1', request())).rejects.toThrow(
      TransferBlockedError,
    );
    expect(context.executeMock).not.toHaveBeenCalled();
    expect(context.model.create).not.toHaveBeenCalled();
  });

  it('stops at the per-transaction limit before burning a fraud check', async () => {
    const big = request({ amount: { minorUnits: 5_000_001, currency: 'GBP', scale: 2 } });

    await expect(context.orchestrator.initiate('cust-1', big)).rejects.toThrow(
      LimitExceededError,
    );
    expect(context.fraudCheck).not.toHaveBeenCalled();
  });

  it('stops on insufficient funds before the rail is involved', async () => {
    context.accounts.balancesFor.mockResolvedValue({
      available: { minorUnits: 5_000, currency: 'GBP' },
    });

    await expect(context.orchestrator.initiate('cust-1', request())).rejects.toThrow(
      InsufficientFundsError,
    );
    expect(context.executeMock).not.toHaveBeenCalled();
  });

  it('a scheduled transfer records without executing, and wakes via the outbox', async () => {
    const executeAt = new Date('2026-08-10T09:00:00.000Z');
    context.standingOrders.plan.mockResolvedValue({
      executeAt,
      schedule: { rrule: null, startsOn: '2026-08-10', endsOn: null, maxOccurrences: null },
      standingOrderId: null,
      nextOccurrenceAt: null,
    });

    await context.orchestrator.initiate(
      'cust-1',
      request({ schedule: { startsOn: '2026-08-10' } }),
    );

    expect(context.executeMock).not.toHaveBeenCalled();
    const [rows] = context.model.create.mock.calls[0] as [{ status: string }[]];
    expect(rows[0]?.status).toBe('scheduled');
    expect(context.outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({ type: TRANSFER_EVENTS.due, availableAt: executeAt }),
      session,
    );
  });

  it('publishes transfer_sent with the receipt payload for an immediate send', async () => {
    await context.orchestrator.initiate('cust-1', request());

    expect(context.outbox.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: TRANSFER_EVENTS.sent,
        payload: expect.objectContaining({ customerId: 'cust-1', rail: 'ach' }),
      }),
      session,
    );
  });
});
