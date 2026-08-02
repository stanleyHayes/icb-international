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

/** Balance thresholds the customer asked to hear about. */

export const lowBalance: TemplateRenderer = (context) => {
  const { payload } = context;
  const balance = moneyText(payload.balance);
  const account = payload.accountLabel ?? FALLBACK.account;

  return renderEmail(
    `Low balance on ${account}`,
    {
      heading: 'Your balance is running low',
      intro: `${account} has fallen to ${balance ?? 'below your alert threshold'}.`,
      ...figureFor(balance),
      rows: rows(
        row(LABEL.account, payload.accountLabel),
        row(LABEL.balance, balance),
        row(LABEL.amount, moneyText(payload.amount)),
      ),
      ...calloutFor(
        'gold',
        'Scheduled payments and standing orders may be returned unpaid if the balance stays below the amount they need.',
      ),
      ...actionFor(CTA.viewAccount, payload.actionUrl),
      outro: 'You can change or turn off this alert in your notification preferences.',
    },
    context,
  );
};

export const largeTransaction: TemplateRenderer = (context) => {
  const { payload } = context;
  const amount = moneyText(payload.amount);

  return renderEmail(
    `Large transaction: ${amount ?? 'unusual activity'}`,
    {
      heading: 'A large transaction went through',
      intro: `${amount ?? 'A large amount'} moved on ${payload.accountLabel ?? FALLBACK.account}, which is above the threshold you set.`,
      ...figureFor(amount),
      rows: rows(
        row(LABEL.account, payload.accountLabel),
        row(LABEL.to, payload.counterparty ?? payload.merchant),
        row(LABEL.reference, payload.reference),
        row(LABEL.when, formatInstant(context.occurredAt)),
        row(LABEL.balance, moneyText(payload.balance)),
      ),
      ...calloutFor('gold', payload.detail),
      ...actionFor(CTA.viewActivity, payload.actionUrl),
      outro: SECURITY_OUTRO,
    },
    context,
  );
};
