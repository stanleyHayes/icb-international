import { fromMinorUnits } from '@icb/money';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { StepUpRequiredError } from '../../../common/errors/index.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { destinationFingerprint, signTransferQuote } from '../domain/quote-signature.js';
import { TRANSFER_QUOTE_TTL_MS } from '../domain/transfers.constants.js';
import {
  TRANSFER_QUOTE_STATUSES,
  type TransferQuoteDoc,
} from '../infrastructure/transfer-quote.schemas.js';
import { TransferQuoteRedemptionService } from '../application/transfer-quote-redemption.service.js';
import {
  HIGH_VALUE_TRANSFER_PURPOSE,
  TransferStepUpService,
} from '../application/transfer-step-up.service.js';

const NOW = new Date('2026-08-04T10:00:00.000Z');
const KEY = 'unit-test-signing-key';
const CUSTOMER_ID = 'cust-1';
const USER_ID = 'user-1';
/** £10,000.00 — exactly the step-up threshold in GBP minor units. */
const THRESHOLD_MINOR_UNITS = 1_000_000;
const BELOW_THRESHOLD_MINOR_UNITS = 100_000;

const DESTINATION = { kind: 'icb_customer', accountNumber: '0011223344' } as const;
const BINDING = { fromAccountId: 'acct-1', destination: DESTINATION };
const VALID_CLAIMS = { sub: USER_ID, purpose: HIGH_VALUE_TRANSFER_PURPOSE };

function quoteDoc(debitMinorUnits: number, overrides: Record<string, unknown> = {}): TransferQuoteDoc {
  const expiresAtMs = NOW.getTime() + TRANSFER_QUOTE_TTL_MS;
  const terms = {
    quoteId: 'q-1',
    customerId: CUSTOMER_ID,
    fromAccountId: 'acct-1',
    rail: 'on_us',
    destinationKey: destinationFingerprint(DESTINATION),
    debitMinorUnits,
    debitCurrency: 'GBP',
    creditMinorUnits: debitMinorUnits,
    creditCurrency: 'GBP',
    feeMinorUnits: 0,
    fxRate: null,
    expiresAtMs,
  };
  return {
    _id: terms.quoteId,
    customerId: terms.customerId,
    fromAccountId: terms.fromAccountId,
    destination: DESTINATION,
    destinationKey: terms.destinationKey,
    rail: 'on_us',
    debit: { minorUnits: debitMinorUnits, currency: 'GBP' },
    credit: { minorUnits: debitMinorUnits, currency: 'GBP' },
    feeMinorUnits: 0,
    feeBreakdown: [],
    fxRate: null,
    fxSpreadBps: null,
    fxRoundingDelta: 0,
    estimatedArrival: new Date(expiresAtMs),
    cutOffAt: null,
    status: TRANSFER_QUOTE_STATUSES.ISSUED,
    signature: signTransferQuote(KEY, terms),
    issuedAt: NOW,
    expiresAt: new Date(expiresAtMs),
    redeemedAt: null,
    redeemedTransferId: null,
    ...overrides,
  };
}

function lean(value: unknown) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

function setup(doc: TransferQuoteDoc) {
  const model = {
    findOne: vi.fn().mockReturnValue(lean(doc)),
    findOneAndUpdate: vi.fn().mockReturnValue(lean({ ...doc, status: 'redeemed' })),
    updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }),
  };
  const tokens = { verifyStepUpToken: vi.fn() };
  const clock = new ClockService();
  clock.freeze(NOW);
  const config = { crypto: { fieldEncryptionKey: KEY } } as AppConfiguration;

  const stepUp = new TransferStepUpService(tokens as never);
  const redemption = new TransferQuoteRedemptionService(
    model as never,
    stepUp,
    clock,
    config,
  );
  return { model, tokens, redemption };
}

describe('TransferStepUpService', () => {
  const tokens = { verifyStepUpToken: vi.fn() };
  const stepUp = new TransferStepUpService(tokens as never);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects a missing token with the high-value purpose', async () => {
    await expect(stepUp.assert(undefined)).rejects.toThrow(StepUpRequiredError);
    await expect(stepUp.assert({ userId: USER_ID, token: undefined })).rejects.toThrow(
      expect.objectContaining({ code: 'STEP_UP_REQUIRED' }) as Error,
    );
  });

  it('rejects a token minted for another purpose or another user', async () => {
    tokens.verifyStepUpToken.mockResolvedValue({ sub: USER_ID, purpose: 'card_pan_reveal' });
    await expect(stepUp.assert({ userId: USER_ID, token: 'tok' })).rejects.toThrow(
      StepUpRequiredError,
    );

    tokens.verifyStepUpToken.mockResolvedValue({ ...VALID_CLAIMS, sub: 'user-2' });
    await expect(stepUp.assert({ userId: USER_ID, token: 'tok' })).rejects.toThrow(
      StepUpRequiredError,
    );
  });

  it('accepts a token that verifies for the caller and the purpose', async () => {
    tokens.verifyStepUpToken.mockResolvedValue(VALID_CLAIMS);

    await expect(stepUp.assert({ userId: USER_ID, token: 'tok' })).resolves.toBeUndefined();
  });
});

describe('TransferQuoteRedemptionService.confirm', () => {
  it('refuses a step-up-flagged quote without a proof — and leaves the quote unspent', async () => {
    const { model, redemption } = setup(quoteDoc(THRESHOLD_MINOR_UNITS));

    await expect(redemption.confirm(CUSTOMER_ID, 'q-1', BINDING)).rejects.toThrow(
      expect.objectContaining({
        code: 'STEP_UP_REQUIRED',
        context: { purpose: HIGH_VALUE_TRANSFER_PURPOSE },
      }) as Error,
    );
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('spends a step-up-flagged quote once the proof verifies', async () => {
    const { model, tokens, redemption } = setup(quoteDoc(THRESHOLD_MINOR_UNITS));
    tokens.verifyStepUpToken.mockResolvedValue(VALID_CLAIMS);

    const redeemed = await redemption.confirm(CUSTOMER_ID, 'q-1', BINDING, {
      userId: USER_ID,
      token: 'step-up-token',
    });

    expect(model.findOneAndUpdate).toHaveBeenCalledOnce();
    expect(redeemed.debit.minorUnits).toBe(THRESHOLD_MINOR_UNITS);
  });

  it('does not ask for a proof when the quote is below the threshold', async () => {
    const { model, tokens, redemption } = setup(quoteDoc(BELOW_THRESHOLD_MINOR_UNITS));

    const redeemed = await redemption.confirm(CUSTOMER_ID, 'q-1', BINDING);

    expect(model.findOneAndUpdate).toHaveBeenCalledOnce();
    expect(tokens.verifyStepUpToken).not.toHaveBeenCalled();
    expect(redeemed.quoteId).toBe('q-1');
  });
});

describe('TransferQuoteRedemptionService.assertHighValueStepUp', () => {
  it('applies the same threshold to quote-less inline terms', async () => {
    const { tokens, redemption } = setup(quoteDoc(BELOW_THRESHOLD_MINOR_UNITS));
    const high = fromMinorUnits(THRESHOLD_MINOR_UNITS, 'GBP');
    const zero = fromMinorUnits(0, 'GBP');

    await expect(redemption.assertHighValueStepUp(high, zero, undefined)).rejects.toThrow(
      StepUpRequiredError,
    );
    expect(tokens.verifyStepUpToken).not.toHaveBeenCalled();
  });

  it('lets a low-value inline transfer through without a proof', async () => {
    const { tokens, redemption } = setup(quoteDoc(BELOW_THRESHOLD_MINOR_UNITS));

    await expect(
      redemption.assertHighValueStepUp(
        fromMinorUnits(BELOW_THRESHOLD_MINOR_UNITS, 'GBP'),
        fromMinorUnits(0, 'GBP'),
        undefined,
      ),
    ).resolves.toBeUndefined();
    expect(tokens.verifyStepUpToken).not.toHaveBeenCalled();
  });
});
