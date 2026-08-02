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

/** Money leaving, money arriving, and money that never made it. */

export const transferSent: TemplateRenderer = (context) => {
  const { payload } = context;
  const amount = moneyText(payload.amount);
  const counterparty = payload.counterparty ?? FALLBACK.counterparty;

  return renderEmail(
    `You sent ${amount ?? FALLBACK.amount}`,
    {
      heading: 'Your transfer is on its way',
      intro: `${amount ?? 'A transfer'} has left ${payload.accountLabel ?? FALLBACK.account} on its way to ${counterparty}.`,
      ...figureFor(amount),
      rows: rows(
        row(LABEL.to, payload.counterparty),
        row(LABEL.from, payload.accountLabel),
        row(LABEL.reference, payload.reference),
        row(LABEL.balance, moneyText(payload.balance)),
      ),
      ...calloutFor('navy', payload.detail),
      ...actionFor(CTA.viewTransfer, payload.actionUrl),
      outro: SECURITY_OUTRO,
    },
    context,
  );
};

export const transferReceived: TemplateRenderer = (context) => {
  const { payload } = context;
  const amount = moneyText(payload.amount);
  const sender = payload.counterparty ?? FALLBACK.sender;

  return renderEmail(
    `You received ${amount ?? FALLBACK.amount}`,
    {
      heading: 'Money has landed',
      intro: `${amount ?? 'A payment'} from ${sender} has been credited to ${payload.accountLabel ?? FALLBACK.account}.`,
      ...figureFor(amount),
      rows: rows(
        row(LABEL.from, payload.counterparty),
        row(LABEL.account, payload.accountLabel),
        row(LABEL.reference, payload.reference),
        row(LABEL.balance, moneyText(payload.balance)),
      ),
      ...calloutFor('success', payload.detail),
      ...actionFor(CTA.viewActivity, payload.actionUrl),
    },
    context,
  );
};

export const transferFailed: TemplateRenderer = (context) => {
  const { payload } = context;
  const amount = moneyText(payload.amount);

  return renderEmail(
    `We could not complete your ${amount ?? 'transfer'}`,
    {
      heading: 'That transfer did not go through',
      intro: `${amount ?? 'Your transfer'} to ${payload.counterparty ?? FALLBACK.counterparty} was not completed. No money has left your account.`,
      ...figureFor(amount),
      rows: rows(
        row(LABEL.to, payload.counterparty),
        row(LABEL.from, payload.accountLabel),
        row(LABEL.reference, payload.reference),
        row(LABEL.reason, payload.reason ?? FALLBACK.reason),
      ),
      ...calloutFor(
        'danger',
        'Any amount held for this transfer has been released back to your available balance.',
      ),
      ...actionFor(CTA.viewTransfer, payload.actionUrl),
      outro: 'You can correct the details and try again at any time.',
    },
    context,
  );
};
