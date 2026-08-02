import {
  actionFor,
  calloutFor,
  figureFor,
  moneyText,
  renderEmail,
  row,
  rows,
} from './email-block.js';
import { CTA, FALLBACK, LABEL, SECURITY_OUTRO } from './labels.js';
import type { TemplateRenderer } from './template.types.js';
import { formatInstant } from './theme.js';

/** Card authorisations, approved and refused. */

export const cardTransaction: TemplateRenderer = (context) => {
  const { payload } = context;
  const amount = moneyText(payload.amount);
  const merchant = payload.merchant ?? payload.counterparty ?? FALLBACK.merchant;

  return renderEmail(
    `${amount ?? 'A card payment'} at ${merchant}`,
    {
      heading: 'Card payment authorised',
      intro: `${amount ?? 'A card payment'} was authorised at ${merchant}.`,
      ...figureFor(amount),
      rows: rows(
        row(LABEL.merchant, payload.merchant ?? payload.counterparty),
        row(LABEL.card, payload.accountLabel),
        row(LABEL.location, payload.location),
        row(LABEL.when, formatInstant(context.occurredAt)),
        row(LABEL.balance, moneyText(payload.balance)),
      ),
      ...calloutFor('navy', payload.detail),
      ...actionFor(CTA.viewCard, payload.actionUrl),
      outro: SECURITY_OUTRO,
    },
    context,
  );
};

export const cardDeclined: TemplateRenderer = (context) => {
  const { payload } = context;
  const amount = moneyText(payload.amount);
  const merchant = payload.merchant ?? payload.counterparty ?? FALLBACK.merchant;

  return renderEmail(
    `Card declined at ${merchant}`,
    {
      heading: 'Your card was declined',
      intro: `We turned down ${amount ?? 'a payment'} at ${merchant}. Nothing has been taken from your account.`,
      ...figureFor(amount),
      rows: rows(
        row(LABEL.merchant, payload.merchant ?? payload.counterparty),
        row(LABEL.card, payload.accountLabel),
        row(LABEL.location, payload.location),
        row(LABEL.reason, payload.reason ?? FALLBACK.reason),
      ),
      ...calloutFor(
        'danger',
        'Check your card controls, spending limits and available balance before trying again.',
      ),
      ...actionFor(CTA.viewCard, payload.actionUrl),
      outro: SECURITY_OUTRO,
    },
    context,
  );
};
