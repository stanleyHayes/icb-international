import { fromMinorUnits } from '@icb/money';
import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError, ValidationError } from '../../../common/errors/index.js';
import type { AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import {
  QuoteAlreadyUsedError,
  QuoteExpiredError,
  QuoteSignatureInvalidError,
} from '../domain/fx-errors.js';
import { signQuote, type SignedQuoteTerms } from '../domain/quote-signature.js';
import { FxConversionService } from '../fx-conversion.service.js';
import { FX_QUOTE_TTL_SECONDS, FxQuotesService } from '../fx-quotes.service.js';
import type { FxQuoteRequest } from '../infrastructure/fx-quote.factory.js';
import { QUOTE_STATUSES, type FxQuoteDoc } from '../infrastructure/fx.schemas.js';

const KEY = 'test-encryption-key';
const CUSTOMER_ID = 'cust-1';
const QUOTE_ID = 'quote-1';
const NOW = new Date('2026-08-04T10:00:00.000Z');
const EXPIRES_AT = new Date(NOW.getTime() + FX_QUOTE_TTL_SECONDS * 1000);

function frozenClock(): ClockService {
  const clock = new ClockService();
  clock.freeze(NOW);
  return clock;
}

function request(overrides: Partial<FxQuoteRequest> = {}): FxQuoteRequest {
  return { from: 'USD', to: 'EUR', amountMinorUnits: 10_000, amountSide: 'sell', ...overrides };
}

function termsFor(doc: FxQuoteDoc): SignedQuoteTerms {
  return {
    quoteId: doc._id,
    customerId: doc.customerId,
    from: doc.fromCurrency,
    to: doc.toCurrency,
    fromMinorUnits: doc.fromMinorUnits,
    toMinorUnits: doc.toMinorUnits,
    rate: doc.rate,
    expiresAtMs: doc.expiresAt.getTime(),
  };
}

function quoteDoc(overrides: Partial<FxQuoteDoc> = {}): FxQuoteDoc {
  const doc = {
    _id: QUOTE_ID,
    customerId: CUSTOMER_ID,
    fromCurrency: 'USD',
    toCurrency: 'EUR',
    fromMinorUnits: 10_000,
    toMinorUnits: 9_200,
    rate: 0.92,
    midRate: 0.93,
    spreadBps: 90,
    roundingDelta: 0,
    amountSide: 'sell',
    status: QUOTE_STATUSES.ISSUED,
    signature: '',
    issuedAt: NOW,
    expiresAt: EXPIRES_AT,
    redeemedAt: null,
    redeemedTransactionId: null,
    ...overrides,
  };
  if (!overrides.signature) {
    doc.signature = signQuote(KEY, termsFor(doc));
  }
  return doc;
}

function leanQuery(result: unknown) {
  return { lean: () => Promise.resolve(result) };
}

function setup(loaded: FxQuoteDoc | null = quoteDoc()) {
  const model = {
    create: vi.fn().mockImplementation(([doc]: [FxQuoteDoc]) => Promise.resolve([doc])),
    findOne: vi.fn().mockReturnValue(leanQuery(loaded)),
    findOneAndUpdate: vi.fn().mockReturnValue(leanQuery(loaded)),
    updateOne: vi.fn().mockResolvedValue({}),
  };
  const rates = { midFor: vi.fn().mockReturnValue(0.93) };
  const tiers = { spreadBpsFor: vi.fn().mockResolvedValue(90) };
  const config = { crypto: { fieldEncryptionKey: KEY } } as unknown as AppConfiguration;
  const clock = frozenClock();
  const service = new FxQuotesService(
    model as unknown as Model<FxQuoteDoc>,
    rates as never,
    new FxConversionService(),
    tiers as never,
    clock,
    config,
  );
  return { service, model, rates, tiers, clock, loaded };
}

describe('FxQuotesService.issue', () => {
  it('rejects a pair quoted against itself', async () => {
    const { service } = setup();
    await expect(service.issue(CUSTOMER_ID, request({ to: 'USD' }))).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('prices a sell-side quote at the tier spread and persists it issued', async () => {
    const { service, model, tiers, rates } = setup();

    const quote = await service.issue(CUSTOMER_ID, request());

    expect(tiers.spreadBpsFor).toHaveBeenCalledWith(CUSTOMER_ID);
    expect(rates.midFor).toHaveBeenCalledWith('USD', 'EUR', NOW);
    expect(model.create).toHaveBeenCalledWith(
      [expect.objectContaining({ fromCurrency: 'USD', toCurrency: 'EUR', status: 'issued' })],
      { ordered: true },
    );
    expect(quote.from).toEqual({ minorUnits: 10_000, currency: 'USD', scale: 2 });
    expect(quote.validForSeconds).toBe(FX_QUOTE_TTL_SECONDS);
  });

  it('prices a buy-side quote backwards at the reciprocal rate', async () => {
    const { service } = setup();
    const buy = await service.issue(CUSTOMER_ID, request({ amountSide: 'buy' }));

    // Buying 100.00 EUR fixes the target; the source is derived and never smaller than the sell case.
    expect(buy.to).toEqual({ minorUnits: 10_000, currency: 'EUR', scale: 2 });
    expect(buy.from.minorUnits).toBeGreaterThan(10_000);
  });

  it('fails the whole call when the insert returns nothing', async () => {
    const { service, model } = setup();
    model.create.mockResolvedValue([]);

    await expect(service.issue(CUSTOMER_ID, request())).rejects.toBeInstanceOf(ConflictError);
  });
});

describe('FxQuotesService.get', () => {
  it('throws NotFoundError for an unknown quote', async () => {
    const { service } = setup(null);
    await expect(service.get(CUSTOMER_ID, QUOTE_ID)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects a redeemed quote as already used', async () => {
    const { service } = setup(
      quoteDoc({ status: QUOTE_STATUSES.REDEEMED, redeemedAt: NOW }),
    );
    await expect(service.get(CUSTOMER_ID, QUOTE_ID)).rejects.toBeInstanceOf(QuoteAlreadyUsedError);
  });

  it('marks an out-of-date quote expired when noticed, then throws', async () => {
    const stale = quoteDoc({ expiresAt: NOW });
    const { service, model } = setup(stale);

    await expect(service.get(CUSTOMER_ID, QUOTE_ID)).rejects.toBeInstanceOf(QuoteExpiredError);
    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: QUOTE_ID, status: QUOTE_STATUSES.ISSUED },
      { $set: { status: QUOTE_STATUSES.EXPIRED } },
    );
  });

  it('returns a live quote with a shrinking countdown', async () => {
    const { service, clock } = setup();
    clock.freeze(new Date(NOW.getTime() + 30_000));

    const quote = await service.get(CUSTOMER_ID, QUOTE_ID);
    expect(quote.validForSeconds).toBe(FX_QUOTE_TTL_SECONDS - 30);
  });
});

describe('FxQuotesService.redeem', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  it('spends a live quote through one conditional update', async () => {
    const redeemed = await deps.service.redeem(CUSTOMER_ID, QUOTE_ID, 'txn-1');

    expect(deps.model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ _id: QUOTE_ID, status: QUOTE_STATUSES.ISSUED }),
      { $set: expect.objectContaining({ status: QUOTE_STATUSES.REDEEMED, redeemedTransactionId: 'txn-1' }) },
      { new: true },
    );
    expect(redeemed.from).toEqual(fromMinorUnits(10_000, 'USD'));
    expect(redeemed.rate).toBeCloseTo(0.92, 4);
  });

  it('defaults the transaction reference to null', async () => {
    await deps.service.redeem(CUSTOMER_ID, QUOTE_ID);
    expect(deps.model.findOneAndUpdate).toHaveBeenCalledWith(
      expect.anything(),
      { $set: expect.objectContaining({ redeemedTransactionId: null }) },
      expect.anything(),
    );
  });

  it('loses the race as already used when the conditional update matches nothing', async () => {
    deps.model.findOneAndUpdate.mockReturnValue(leanQuery(null));
    await expect(deps.service.redeem(CUSTOMER_ID, QUOTE_ID)).rejects.toBeInstanceOf(
      QuoteAlreadyUsedError,
    );
  });

  it('refuses a quote whose stored signature does not verify', async () => {
    const tampered = quoteDoc({ signature: signQuote(KEY, { ...termsFor(quoteDoc()), rate: 99 }) });
    const { service } = setup(tampered);

    await expect(service.redeem(CUSTOMER_ID, QUOTE_ID)).rejects.toBeInstanceOf(
      QuoteSignatureInvalidError,
    );
  });

  it('refuses an expired quote without reaching the update', async () => {
    const stale = quoteDoc({ expiresAt: NOW });
    const { service, model } = setup(stale);

    await expect(service.redeem(CUSTOMER_ID, QUOTE_ID)).rejects.toBeInstanceOf(QuoteExpiredError);
    expect(model.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
