import type {
  CardAuthorisation,
  CardChannel,
  CardControls,
  CardDetail,
  CardKind,
  CardLimits,
  CardNetwork,
  CardStatus,
  CardSummary,
} from '@icb/contracts';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import type { CardControlsDoc, CardLimitsDoc } from '../domain/card-defaults.js';
import type { CardAuthorisationDoc } from './card-authorisation.schemas.js';
import type { CardDoc } from './card.schemas.js';

/**
 * Persistence → contract.
 *
 * This is the boundary where the card's secrets are dropped. `panEncrypted`, `cvvEncrypted` and
 * `pinHash` exist on the document and simply have no route out through these functions: the only
 * thing a read returns is `panLast4` and, for the PIN, the boolean `pinSet`. Serialising the whole
 * document anywhere would be the single mistake that leaks a card, so it never happens.
 */

export type CardSpend = CardDetail['spend'];

export function toCardControls(controls: CardControlsDoc): CardControls {
  return {
    channels: { ...controls.channels },
    blockedCategories: [...controls.blockedCategories],
    allowedCountries: controls.allowedCountries ? [...controls.allowedCountries] : null,
  };
}

export function toCardLimits(limits: CardLimitsDoc, currency: string): CardLimits {
  return {
    perTransaction: toMoneyDto(limits.perTransactionMinorUnits, currency),
    daily: toMoneyDto(limits.dailyMinorUnits, currency),
    monthly: toMoneyDto(limits.monthlyMinorUnits, currency),
    atmDaily: toMoneyDto(limits.atmDailyMinorUnits, currency),
    contactless: toMoneyDto(limits.contactlessMinorUnits, currency),
  };
}

export function toCardSummary(card: CardDoc): CardSummary {
  return {
    id: card._id,
    accountId: card.accountId,
    kind: card.kind as CardKind,
    network: card.network as CardNetwork,
    status: card.status as CardStatus,
    nickname: card.nickname,
    cardholderName: card.cardholderName,
    panLast4: card.panLast4,
    expiryMonth: card.expiryMonth,
    expiryYear: card.expiryYear,
    frozen: card.frozen,
    contactlessEnabled: card.contactlessEnabled,
    issuedAt: card.issuedAt.toISOString(),
  };
}

export function toCardDetail(card: CardDoc, spend: CardSpend): CardDetail {
  return {
    ...toCardSummary(card),
    controls: toCardControls(card.controls),
    limits: toCardLimits(card.limits, card.currency),
    spend,
    pinSet: card.pinHash !== null,
    activatedAt: card.activatedAt?.toISOString() ?? null,
    replacedCardId: card.replacedCardId,
    travelNoticeUntil: card.travelNoticeUntil?.toISOString() ?? null,
  };
}

export function toCardAuthorisation(authorisation: CardAuthorisationDoc): CardAuthorisation {
  return {
    id: authorisation._id,
    cardId: authorisation.cardId,
    merchantName: authorisation.merchantName,
    mcc: authorisation.mcc,
    amount: toMoneyDto(authorisation.minorUnits, authorisation.currency),
    billingAmount: toMoneyDto(authorisation.billingMinorUnits, authorisation.currency),
    status: authorisation.status as CardAuthorisation['status'],
    declineReason: authorisation.declineReason,
    channel: authorisation.channel as CardChannel,
    country: authorisation.country,
    arn: authorisation.arn,
    authorisedAt: authorisation.authorisedAt.toISOString(),
    capturedAt: authorisation.capturedAt?.toISOString() ?? null,
  };
}
