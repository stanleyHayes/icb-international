import type { CardControls, CardDetail, CardLimits, CardSpend } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';

import type { FactoryContext } from '../core/context.js';
import { moneyDto, zeroMoney } from './helpers.js';

const CARD_EXPIRY_YEARS = 3;
const PER_TRANSACTION_LIMIT = 500_000;
const DAILY_LIMIT = 1_000_000;
const MONTHLY_LIMIT = 5_000_000;
const ATM_DAILY_LIMIT = 200_000;
const CONTACTLESS_LIMIT = 50_000;

export interface CardOptions extends Partial<CardDetail> {
  readonly currency?: CurrencyCode;
}

/**
 * Card factory.
 *
 * Default: an active Visa debit with every channel enabled and standard limits — the state an
 * authorisation test starts from. `panLast4` only; full PANs belong to the card rail adapter.
 */
export function cardDetail(ctx: FactoryContext, options: CardOptions = {}): CardDetail {
  const { currency = 'GHS', ...overrides } = options;
  const base: CardDetail = {
    id: ctx.nextId(),
    accountId: ctx.nextId(),
    kind: 'debit',
    network: 'visa',
    status: 'active',
    nickname: null,
    cardholderName: ctx.faker.person.fullName().toUpperCase(),
    panLast4: ctx.digits(4),
    expiryMonth: ctx.intBetween(1, 12),
    expiryYear: ctx.clock.now().getUTCFullYear() + CARD_EXPIRY_YEARS,
    frozen: false,
    contactlessEnabled: true,
    issuedAt: ctx.clock.iso(),
    controls: cardControls(),
    limits: cardLimits(currency),
    spend: cardSpend(currency),
    pinSet: true,
    activatedAt: ctx.clock.iso(),
    replacedCardId: null,
    travelNoticeUntil: null,
  };
  return { ...base, ...overrides };
}

export function cardControls(overrides: Partial<CardControls> = {}): CardControls {
  const base: CardControls = {
    channels: {
      online: true,
      contactless: true,
      atm: true,
      international: true,
      in_store: true,
    },
    blockedCategories: [],
    allowedCountries: null,
  };
  return { ...base, ...overrides };
}

export function cardLimits(currency: CurrencyCode, overrides: Partial<CardLimits> = {}): CardLimits {
  const base: CardLimits = {
    perTransaction: moneyDto(PER_TRANSACTION_LIMIT, currency),
    daily: moneyDto(DAILY_LIMIT, currency),
    monthly: moneyDto(MONTHLY_LIMIT, currency),
    atmDaily: moneyDto(ATM_DAILY_LIMIT, currency),
    contactless: moneyDto(CONTACTLESS_LIMIT, currency),
  };
  return { ...base, ...overrides };
}

export function cardSpend(currency: CurrencyCode): CardSpend {
  return {
    todaySpent: zeroMoney(currency),
    monthSpent: zeroMoney(currency),
    dailyRemaining: moneyDto(DAILY_LIMIT, currency),
    monthlyRemaining: moneyDto(MONTHLY_LIMIT, currency),
  };
}
