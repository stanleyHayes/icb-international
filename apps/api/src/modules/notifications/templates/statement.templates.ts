import {
  actionFor,
  calloutFor,
  figureFor,
  moneyText,
  renderEmail,
  row,
  rows,
} from './email-block.js';
import { CTA, FALLBACK, LABEL } from './labels.js';
import type { TemplateRenderer } from './template.types.js';
import { formatDate } from './theme.js';

/** Documents and dated obligations. */

export const statementReady: TemplateRenderer = (context) => {
  const { payload } = context;
  const period = payload.period ?? 'the latest period';

  return renderEmail(
    `Your ${period} statement is ready`,
    {
      heading: 'Your statement is ready',
      intro: `The statement for ${payload.accountLabel ?? FALLBACK.account} covering ${period} is now available.`,
      rows: rows(
        row(LABEL.account, payload.accountLabel),
        row(LABEL.period, payload.period),
        row(LABEL.balance, moneyText(payload.balance)),
      ),
      ...calloutFor(
        'navy',
        'Statements are kept in your document vault for seven years and can be downloaded at any time.',
      ),
      ...actionFor(CTA.viewStatement, payload.actionUrl),
      outro: 'We never attach statements to email. Sign in to download yours.',
    },
    context,
  );
};

export const billDue: TemplateRenderer = (context) => {
  const { payload } = context;
  const amount = moneyText(payload.amount);
  const due = payload.dueDate === undefined ? undefined : formatDate(payload.dueDate);

  return renderEmail(
    `${payload.counterparty ?? 'A bill'} is due${due === undefined ? '' : ` on ${due}`}`,
    {
      heading: 'A bill is coming up',
      intro: `${amount ?? 'A payment'} to ${payload.counterparty ?? 'your biller'} is scheduled${due === undefined ? '' : ` for ${due}`}.`,
      ...figureFor(amount),
      rows: rows(
        row(LABEL.to, payload.counterparty),
        row(LABEL.account, payload.accountLabel),
        row(LABEL.dueDate, due),
        row(LABEL.balance, moneyText(payload.balance)),
      ),
      ...calloutFor('gold', payload.detail),
      ...actionFor(CTA.payBill, payload.actionUrl),
      outro: 'Make sure the funds are available the day before, so the payment is not returned.',
    },
    context,
  );
};
