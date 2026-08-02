import type { CardChannel, TransactionCategory } from '@icb/contracts';

import type { CardControlsDoc, CardLimitsDoc } from './card-defaults.js';

/**
 * The control and limit checks, as pure functions.
 *
 * Every switch a customer can see in the app is decided here, at authorisation time. A control
 * that is merely displayed — stored, shown, and then ignored when the transaction arrives — is
 * worse than no control at all, because the customer believes they are protected.
 *
 * Kept free of I/O so the decision is testable in isolation and so the reason a payment was
 * declined is a value, not a thrown exception buried in a service.
 */

export interface AuthorisationContext {
  readonly controls: CardControlsDoc;
  readonly limits: CardLimitsDoc;
  readonly channel: CardChannel;
  readonly category: TransactionCategory;
  readonly country: string | null;
  readonly homeCountry: string;
  /** Countries covered by an active travel notice — they relax the geographic controls only. */
  readonly travelCountries: readonly string[];
  readonly amountMinorUnits: number;
  readonly spentTodayMinorUnits: number;
  readonly spentMonthMinorUnits: number;
  readonly atmTodayMinorUnits: number;
}

export interface AuthorisationDecline {
  /** `control` maps to CARD_CONTROL_DECLINED, `limit` to LIMIT_EXCEEDED. */
  readonly kind: 'control' | 'limit';
  readonly reason: string;
  readonly limitName?: string;
  readonly limitMinorUnits?: number;
  readonly attemptedMinorUnits?: number;
}

function isTravelling(context: AuthorisationContext): boolean {
  return context.country !== null && context.travelCountries.includes(context.country);
}

function isAbroad(context: AuthorisationContext): boolean {
  return context.country !== null && context.country !== context.homeCountry;
}

/** Channel, category and geography — the switches the customer owns. */
export function checkControls(context: AuthorisationContext): AuthorisationDecline | null {
  const { controls, channel, category, country } = context;

  if (!controls.channels[channel]) {
    return { kind: 'control', reason: `${channel} payments are switched off for this card` };
  }

  if (controls.blockedCategories.includes(category)) {
    return { kind: 'control', reason: `${category} spending is blocked on this card` };
  }

  if (isAbroad(context) && !controls.channels.international && !isTravelling(context)) {
    return { kind: 'control', reason: 'International payments are switched off for this card' };
  }

  if (controls.allowedCountries && country && !controls.allowedCountries.includes(country)) {
    if (!isTravelling(context)) {
      return { kind: 'control', reason: `This card is not enabled for payments in ${country}` };
    }
  }

  return null;
}

interface LimitRule {
  readonly applies: boolean;
  readonly name: string;
  readonly limitMinorUnits: number;
  readonly attemptedMinorUnits: number;
}

/**
 * Limits are evaluated as data rather than as a chain of `if`s so that adding one is a row, and so
 * the order — the most specific limit first — is visible at a glance.
 */
function limitRules(context: AuthorisationContext): readonly LimitRule[] {
  const { limits, amountMinorUnits: amount } = context;
  return [
    {
      applies: true,
      name: 'per-transaction limit',
      limitMinorUnits: limits.perTransactionMinorUnits,
      attemptedMinorUnits: amount,
    },
    {
      applies: context.channel === 'contactless',
      name: 'contactless limit',
      limitMinorUnits: limits.contactlessMinorUnits,
      attemptedMinorUnits: amount,
    },
    {
      applies: context.channel === 'atm',
      name: 'daily ATM limit',
      limitMinorUnits: limits.atmDailyMinorUnits,
      attemptedMinorUnits: context.atmTodayMinorUnits + amount,
    },
    {
      applies: true,
      name: 'daily card limit',
      limitMinorUnits: limits.dailyMinorUnits,
      attemptedMinorUnits: context.spentTodayMinorUnits + amount,
    },
    {
      applies: true,
      name: 'monthly card limit',
      limitMinorUnits: limits.monthlyMinorUnits,
      attemptedMinorUnits: context.spentMonthMinorUnits + amount,
    },
  ];
}

export function checkLimits(context: AuthorisationContext): AuthorisationDecline | null {
  for (const rule of limitRules(context)) {
    if (rule.applies && rule.attemptedMinorUnits > rule.limitMinorUnits) {
      return {
        kind: 'limit',
        reason: `This transaction exceeds your ${rule.name}`,
        limitName: rule.name,
        limitMinorUnits: rule.limitMinorUnits,
        attemptedMinorUnits: rule.attemptedMinorUnits,
      };
    }
  }
  return null;
}

/** The whole decision: controls first, because a switched-off channel is not a spending problem. */
export function evaluateAuthorisation(
  context: AuthorisationContext,
): AuthorisationDecline | null {
  return checkControls(context) ?? checkLimits(context);
}
