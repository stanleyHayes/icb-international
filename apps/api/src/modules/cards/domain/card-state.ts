import { DomainError } from '../../../common/errors/index.js';
import { INITIAL_STATUS, TERMINAL_STATUSES } from './card-defaults.js';
import { isExpired } from './card-numbers.js';

/**
 * Card lifecycle guards.
 *
 * Every state question is asked here rather than at each call site, because "can this card be
 * used?" has four separate answers — reported, frozen, not yet activated, expired — and a service
 * that checks three of them is a service that lets a stolen card through.
 */

/** The minimum a card must expose for its state to be judged. */
export interface CardState {
  readonly _id: string;
  readonly status: string;
  readonly frozen: boolean;
  readonly expiryMonth: number;
  readonly expiryYear: number;
}

const ACTIVE = 'active';
const FROZEN = 'frozen';

function blocked(card: CardState, reason: string): DomainError {
  return new DomainError('CARD_BLOCKED', reason, {
    context: { cardId: card._id, status: card.status },
  });
}

/** Whether the card is in a state it can never leave. Reporting one lost is a one-way door. */
export function isTerminal(card: CardState): boolean {
  return TERMINAL_STATUSES.includes(card.status);
}

/** Can this card authorise a payment right now? */
export function assertCardUsable(card: CardState, at: Date): void {
  if (isTerminal(card)) {
    throw blocked(card, `This card is ${card.status} and can no longer be used`);
  }
  if (card.frozen || card.status === FROZEN) {
    throw blocked(card, 'This card is frozen');
  }
  if (card.status !== ACTIVE) {
    throw blocked(card, 'This card has not been activated yet');
  }
  if (isExpired(card.expiryMonth, card.expiryYear, at)) {
    throw new DomainError('CARD_EXPIRED', 'This card has expired', {
      context: { cardId: card._id, expiryMonth: card.expiryMonth, expiryYear: card.expiryYear },
    });
  }
}

/**
 * Can this card's settings still be changed? A frozen card can — that is how it gets unfrozen —
 * but a cancelled or reported one cannot, because it will never be used again.
 */
export function assertCardAmendable(card: CardState): void {
  if (isTerminal(card)) {
    throw blocked(card, `This card is ${card.status} and can no longer be changed`);
  }
}

/**
 * The status a card lands in after a freeze toggle.
 *
 * Unfreezing returns the card to where it was, which is not always `active`: a card frozen before
 * the customer ever activated it goes back to `issued`, so unfreezing cannot smuggle a card into
 * a usable state without the activation step.
 */
export function statusAfterFreeze(activatedAt: Date | null, frozen: boolean): string {
  if (frozen) {
    return FROZEN;
  }
  return activatedAt ? ACTIVE : INITIAL_STATUS;
}

export const CARD_ACTIVE = ACTIVE;
