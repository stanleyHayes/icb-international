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

/** The two sides of a repayment schedule. */

export const loanPaymentDue: TemplateRenderer = (context) => {
  const { payload } = context;
  const amount = moneyText(payload.amount);
  const due = payload.dueDate === undefined ? undefined : formatDate(payload.dueDate);
  const when = due === undefined ? ' shortly' : ` on ${due}`;

  return renderEmail(
    `Loan repayment of ${amount ?? 'your instalment'} is due`,
    {
      heading: 'Your next repayment is due',
      intro: `${amount ?? 'Your next instalment'} on ${payload.accountLabel ?? 'your loan'} is due${when}.`,
      ...figureFor(amount),
      rows: rows(
        row(LABEL.account, payload.accountLabel),
        row(LABEL.dueDate, due),
        row(LABEL.reference, payload.reference),
        row(LABEL.balance, moneyText(payload.balance)),
      ),
      ...calloutFor(
        'gold',
        'A missed repayment adds arrears interest and is reported to the credit bureau, so tell us early if the date does not work.',
      ),
      ...actionFor(CTA.viewLoan, payload.actionUrl),
      outro: 'We collect automatically from your nominated account on the due date.',
    },
    context,
  );
};

export const loanPaymentReceived: TemplateRenderer = (context) => {
  const { payload } = context;
  const amount = moneyText(payload.amount);

  return renderEmail(
    `We received your repayment of ${amount ?? FALLBACK.amount}`,
    {
      heading: 'Repayment received — thank you',
      intro: `${amount ?? 'Your repayment'} has been applied to ${payload.accountLabel ?? 'your loan'}.`,
      ...figureFor(amount),
      rows: rows(
        row(LABEL.account, payload.accountLabel),
        row(LABEL.amount, amount),
        row(LABEL.reference, payload.reference),
        row('Outstanding balance', moneyText(payload.balance)),
      ),
      ...calloutFor('success', payload.detail),
      ...actionFor(CTA.viewLoan, payload.actionUrl),
      outro: 'Interest is charged on the balance after this payment was applied.',
    },
    context,
  );
};
