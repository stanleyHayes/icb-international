import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RiskService } from '../../../risk/risk.service.js';
import type { FraudCheckInput } from '../fraud-check.port.js';
import { RiskFraudCheckAdapter } from '../risk-fraud-check.adapter.js';

/** The required core of a request: a caller that observed no signals sends exactly this. */
function unsignalledInput(): FraudCheckInput {
  return {
    customerId: 'cust-1',
    subjectId: 'tr-1',
    amountMinorUnits: 25_000,
    currency: 'GBP',
  };
}

function input(overrides: Partial<FraudCheckInput> = {}): FraudCheckInput {
  return {
    ...unsignalledInput(),
    beneficiaryId: 'ben-1',
    countryCode: 'GB',
    ...overrides,
  };
}

function setup() {
  const assess = vi.fn().mockResolvedValue({ id: 'risk-1', decision: 'allow' });
  const risk = { assess } as unknown as RiskService;
  return { assess, adapter: new RiskFraudCheckAdapter(risk) };
}

describe('RiskFraudCheckAdapter', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('hands the risk engine a transfer-scoped assessment request', async () => {
    await context.adapter.check(input());

    expect(context.assess).toHaveBeenCalledWith({
      subjectType: 'transfer',
      subjectId: 'tr-1',
      customerId: 'cust-1',
      amountMinorUnits: 25_000,
      currency: 'GBP',
      signals: { beneficiaryId: 'ben-1', countryCode: 'GB' },
    });
  });

  it('sends null signals when the caller observed none', async () => {
    await context.adapter.check(unsignalledInput());

    const [request] = context.assess.mock.calls[0] as [
      { signals: { beneficiaryId: string | null; countryCode: string | null } },
    ];
    expect(request.signals).toEqual({ beneficiaryId: null, countryCode: null });
  });

  it('returns the engine decision and the stored assessment id', async () => {
    context.assess.mockResolvedValue({ id: 'risk-9', decision: 'review' });

    await expect(context.adapter.check(input())).resolves.toEqual({
      decision: 'review',
      assessmentId: 'risk-9',
    });
  });

  it('propagates a block decision untouched — the orchestrator decides what it means', async () => {
    context.assess.mockResolvedValue({ id: 'risk-2', decision: 'block' });

    const outcome = await context.adapter.check(input());

    expect(outcome.decision).toBe('block');
  });
});
