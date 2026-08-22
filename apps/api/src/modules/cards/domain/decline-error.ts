import { fromMinorUnits, type CurrencyCode } from '@icb/money';

import { DomainError, LimitExceededError } from '../../../common/errors/index.js';
import type { CardDoc } from '../infrastructure/card.schemas.js';

import type { AuthorisationDecline } from './authorisation-rules.js';

/** A control failure and a limit failure are different problems, so they get different codes. */
export function toDeclineError(card: CardDoc, decline: AuthorisationDecline): DomainError {
  if (decline.kind === 'control') {
    return new DomainError('CARD_CONTROL_DECLINED', decline.reason, {
      context: { cardId: card._id },
    });
  }

  const currency = card.currency as CurrencyCode;
  return new LimitExceededError(
    decline.limitName ?? 'card limit',
    fromMinorUnits(decline.limitMinorUnits ?? 0, currency),
    fromMinorUnits(decline.attemptedMinorUnits ?? 0, currency),
  );
}
