import type { CardChannel, CardKind, TransactionCategory } from '@icb/contracts';

/**
 * How a card behaves the moment it is issued.
 *
 * The defaults are deliberately conservative — international is off, a virtual card cannot be used
 * at an ATM — because the safe state is the one a customer never has to think about, and turning a
 * control *on* is a decision they make knowingly.
 */

/** Controls as persisted. Mirrors `CardControls` from the contract, minus the wire concerns. */
export interface CardControlsDoc {
  channels: Record<CardChannel, boolean>;
  blockedCategories: TransactionCategory[];
  allowedCountries: string[] | null;
}

/** Limits as persisted: integer minor units, never a float, never a formatted string. */
export interface CardLimitsDoc {
  perTransactionMinorUnits: number;
  dailyMinorUnits: number;
  monthlyMinorUnits: number;
  atmDailyMinorUnits: number;
  contactlessMinorUnits: number;
}

const PHYSICAL_CHANNELS: Readonly<Record<CardChannel, boolean>> = {
  online: true,
  contactless: true,
  atm: true,
  international: false,
  in_store: true,
};

/** A virtual card exists for online use; there is no plastic to tap or feed into an ATM. */
const VIRTUAL_CHANNELS: Readonly<Record<CardChannel, boolean>> = {
  online: true,
  contactless: false,
  atm: false,
  international: true,
  in_store: false,
};

export function defaultControls(kind: CardKind): CardControlsDoc {
  return {
    channels: { ...(kind === 'virtual' ? VIRTUAL_CHANNELS : PHYSICAL_CHANNELS) },
    blockedCategories: [],
    allowedCountries: null,
  };
}

const LIMITS_BY_KIND: Readonly<Record<CardKind, CardLimitsDoc>> = {
  debit: {
    perTransactionMinorUnits: 200_000,
    dailyMinorUnits: 500_000,
    monthlyMinorUnits: 5_000_000,
    atmDailyMinorUnits: 100_000,
    contactlessMinorUnits: 10_000,
  },
  credit: {
    perTransactionMinorUnits: 500_000,
    dailyMinorUnits: 1_000_000,
    monthlyMinorUnits: 10_000_000,
    atmDailyMinorUnits: 50_000,
    contactlessMinorUnits: 10_000,
  },
  virtual: {
    perTransactionMinorUnits: 100_000,
    dailyMinorUnits: 250_000,
    monthlyMinorUnits: 2_000_000,
    atmDailyMinorUnits: 0,
    contactlessMinorUnits: 0,
  },
};

export function defaultLimits(kind: CardKind): CardLimitsDoc {
  return { ...LIMITS_BY_KIND[kind] };
}

/** A newly issued card is inactive until the customer confirms they have it in hand. */
export const INITIAL_STATUS = 'issued';

/** Statuses from which a card can never be used again — reporting one is a one-way door. */
export const TERMINAL_STATUSES: readonly string[] = ['lost', 'stolen', 'cancelled', 'expired'];
