import type { TransferQuoteRequest } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { NotFoundError, ValidationError } from '../../../../common/errors/index.js';
import type { AppConfiguration } from '../../../../config/configuration.js';
import { ClockService } from '../../../../simulation/clock/clock.service.js';
import {
  destinationFingerprint,
  signTransferQuote,
  type SignedTransferQuoteTerms,
} from '../../domain/quote-signature.js';
import {
  TransferQuoteAlreadyUsedError,
  TransferQuoteExpiredError,
  TransferQuoteSignatureInvalidError,
} from '../../domain/transfer-errors.js';
import { TRANSFER_QUOTE_TTL_MS } from '../../domain/transfers.constants.js';
import {
  TRANSFER_QUOTE_STATUSES,
  type TransferQuoteDoc,
} from '../../infrastructure/transfer-quote.schemas.js';
import type { TransferPricing } from '../transfer-pricing.js';
import { TransferQuoteRedemptionService } from '../transfer-quote-redemption.service.js';
import { TransferQuotesService } from '../transfer-quotes.service.js';

const NOW = new Date('2026-08-03T10:00:00.000Z');
const KEY = 'unit-test-signing-key';
const DESTINATION = {
  kind: 'domestic_bank' as const,
  accountNumber: '12345678',
  sortCode: '12-34-56',
  accountHolderName: 'Jane Doe',
};

function setup() {
  const model = {
    create: vi.fn(),
    findOne: vi.fn(),
    findOneAndUpdate: vi.fn(),
    updateOne: vi.fn(),
  };
  const accounts = { loadSpendable: vi.fn().mockResolvedValue({ currency: 'GBP' }) };
  const destinations = {
    resolve: vi.fn().mockResolvedValue({
      destination: DESTINATION,
      beneficiaryId: null,
      beneficiaryName: null,
      beneficiaryMasked: null,
    }),
  };
  const fxIssue = vi.fn();
  const pricing: TransferPricing = {
    fxQuotes: { issue: fxIssue } as never,
    rails: {
      dispatch: vi.fn(),
      estimate: vi.fn().mockResolvedValue({
        settlesAt: new Date('2026-08-04T10:00:00.000Z'),
        cutOffAt: new Date('2026-08-03T15:00:00.000Z'),
        pastCutOff: false,
      }),
    },
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const config = { crypto: { fieldEncryptionKey: KEY } } as AppConfiguration;
  const service = new TransferQuotesService(
    model as never,
    accounts as never,
    destinations as never,
    pricing,
    clock,
    config,
  );
  const redemption = new TransferQuoteRedemptionService(
    model as never,
    { assert: vi.fn().mockResolvedValue(undefined) } as never,
    clock,
    config,
  );
  return { model, accounts, destinations, pricing, fxIssue, clock, service, redemption };
}

function quoteRequest(overrides: Partial<TransferQuoteRequest> = {}): TransferQuoteRequest {
  return {
    fromAccountId: 'acct-1',
    destination: DESTINATION,
    amount: { minorUnits: 10_000, currency: 'GBP', scale: 2 },
    amountSide: 'debit',
    ...overrides,
  };
}

function termsFor(doc: Partial<SignedTransferQuoteTerms>): SignedTransferQuoteTerms {
  return {
    quoteId: 'q-1',
    customerId: 'cust-1',
    fromAccountId: 'acct-1',
    rail: 'ach',
    destinationKey: destinationFingerprint(DESTINATION),
    debitMinorUnits: 10_000,
    debitCurrency: 'GBP',
    creditMinorUnits: 10_000,
    creditCurrency: 'GBP',
    feeMinorUnits: 0,
    fxRate: null,
    expiresAtMs: NOW.getTime() + TRANSFER_QUOTE_TTL_MS,
    ...doc,
  };
}

function quoteDoc(overrides: Record<string, unknown> = {}): TransferQuoteDoc {
  const terms = termsFor({});
  return {
    _id: terms.quoteId,
    customerId: terms.customerId,
    fromAccountId: terms.fromAccountId,
    destination: DESTINATION,
    destinationKey: terms.destinationKey,
    rail: 'ach',
    debit: { minorUnits: 10_000, currency: 'GBP' },
    credit: { minorUnits: 10_000, currency: 'GBP' },
    feeMinorUnits: 0,
    feeBreakdown: [],
    fxRate: null,
    fxSpreadBps: null,
    fxRoundingDelta: 0,
    estimatedArrival: new Date('2026-08-04T10:00:00.000Z'),
    cutOffAt: null,
    status: TRANSFER_QUOTE_STATUSES.ISSUED,
    signature: signTransferQuote(KEY, terms),
    issuedAt: NOW,
    expiresAt: new Date(terms.expiresAtMs),
    redeemedAt: null,
    redeemedTransferId: null,
    ...overrides,
  };
}

const BINDING = { fromAccountId: 'acct-1', destination: DESTINATION };

function lean(value: unknown) {
  return { lean: vi.fn().mockResolvedValue(value) };
}

describe('issue', () => {
  it('quotes a same-currency ACH transfer with no fee and no FX', async () => {
    const { model, service } = setup();
    model.create.mockImplementation((rows: unknown[]) => Promise.resolve(rows));

    await service.issue('cust-1', quoteRequest());

    const [rows] = model.create.mock.calls[0] as [Record<string, unknown>[]];
    expect(rows[0]).toMatchObject({
      rail: 'ach',
      feeMinorUnits: 0,
      fxRate: null,
      status: 'issued',
    });
    expect(rows[0]?.['signature']).toMatch(/^[0-9a-f]{64}$/);
    expect((rows[0]?.['expiresAt'] as Date).getTime()).toBe(NOW.getTime() + TRANSFER_QUOTE_TTL_MS);
  });

  it('rejects a rail that cannot serve the destination', async () => {
    const { service } = setup();
    await expect(service.issue('cust-1', quoteRequest({ rail: 'swift' }))).rejects.toThrow(
      ValidationError,
    );
  });

  it('prices cross-currency credit-side through the FX module', async () => {
    const { model, fxIssue, service } = setup();
    model.create.mockImplementation((rows: unknown[]) => Promise.resolve(rows));
    fxIssue.mockResolvedValue({
      quoteId: 'fxq-1',
      from: { minorUnits: 10_870, currency: 'GBP', scale: 2 },
      to: { minorUnits: 10_000, currency: 'EUR', scale: 2 },
      rate: 0.92,
      spreadBps: 50,
    });

    await service.issue(
      'cust-1',
      quoteRequest({
        amount: { minorUnits: 10_000, currency: 'EUR', scale: 2 },
        amountSide: 'credit',
      }),
    );

    expect(fxIssue).toHaveBeenCalledWith('cust-1', {
      from: 'GBP',
      to: 'EUR',
      amountMinorUnits: 10_000,
      amountSide: 'buy',
    });
    const [rows] = model.create.mock.calls[0] as [Record<string, unknown>[]];
    expect(rows[0]).toMatchObject({ fxRate: 0.92, fxSpreadBps: 50 });
    expect(rows[0]?.['debit']).toEqual({ minorUnits: 10_870, currency: 'GBP' });
  });

  it('refuses cross-currency fixed on the debit side', async () => {
    const { service } = setup();
    await expect(
      service.issue(
        'cust-1',
        quoteRequest({ amount: { minorUnits: 10_000, currency: 'EUR', scale: 2 } }),
      ),
    ).rejects.toThrow(ValidationError);
  });
});

describe('redeem', () => {
  let context: ReturnType<typeof setup>;

  beforeEach(() => {
    context = setup();
  });

  it('returns the signed terms for a live quote', async () => {
    const { model, redemption } = context;
    model.findOne.mockReturnValue(lean(quoteDoc()));
    model.findOneAndUpdate.mockReturnValue(lean(quoteDoc({ status: 'redeemed' })));

    const redeemed = await redemption.confirm('cust-1', 'q-1', BINDING);

    expect(redeemed.debit).toEqual({ minorUnits: 10_000, currency: 'GBP' });
    expect(redeemed.rail).toBe('ach');
    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: 'q-1', status: 'issued' }),
      expect.anything(),
      expect.anything(),
    );
  });

  it('throws QUOTE_EXPIRED once the TTL has elapsed, and records the expiry', async () => {
    const { model, clock, redemption } = context;
    model.findOne.mockReturnValue(lean(quoteDoc()));
    clock.advance(TRANSFER_QUOTE_TTL_MS + 1000);

    await expect(redemption.confirm('cust-1', 'q-1', BINDING)).rejects.toThrow(
      TransferQuoteExpiredError,
    );
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: 'q-1', status: 'issued' },
      { $set: { status: 'expired' } },
    );
  });

  it('is single-use: a second redemption loses the race', async () => {
    const { model, redemption } = context;
    model.findOne.mockReturnValue(lean(quoteDoc()));
    model.findOneAndUpdate.mockReturnValue(lean(null));

    await expect(redemption.confirm('cust-1', 'q-1', BINDING)).rejects.toThrow(
      TransferQuoteAlreadyUsedError,
    );
  });

  it('rejects an already-redeemed quote before any update', async () => {
    const { model, redemption } = context;
    model.findOne.mockReturnValue(lean(quoteDoc({ status: TRANSFER_QUOTE_STATUSES.REDEEMED })));

    await expect(redemption.confirm('cust-1', 'q-1', BINDING)).rejects.toThrow(
      TransferQuoteAlreadyUsedError,
    );
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects a tampered quote: edited terms no longer verify', async () => {
    const { model, redemption } = context;
    model.findOne.mockReturnValue(lean(quoteDoc({ feeMinorUnits: 999_999 })));

    await expect(redemption.confirm('cust-1', 'q-1', BINDING)).rejects.toThrow(
      TransferQuoteSignatureInvalidError,
    );
  });

  it('pays only the destination the quote was issued for', async () => {
    const { model, redemption } = context;
    model.findOne.mockReturnValue(lean(quoteDoc()));

    await expect(
      redemption.confirm('cust-1', 'q-1', {
        fromAccountId: 'acct-1',
        destination: { kind: 'icb_customer', accountNumber: '0011223344' },
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('throws NotFound for an unknown quote', async () => {
    const { model, redemption } = context;
    model.findOne.mockReturnValue(lean(null));

    await expect(redemption.confirm('cust-1', 'nope', BINDING)).rejects.toThrow(NotFoundError);
  });
});
