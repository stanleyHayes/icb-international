import { actionFor, calloutFor, moneyText, renderEmail, row, rows } from './email-block.js';
import { CTA, LABEL } from './labels.js';
import type { TemplateRenderer } from './template.types.js';
import { formatInstant } from './theme.js';

/** Relationship servicing: verification, disputes and product news. */

export const kycUpdate: TemplateRenderer = (context) => {
  const { payload } = context;
  const status = payload.status ?? 'updated';

  return renderEmail(
    `Your verification status is now ${status}`,
    {
      heading: 'An update on your verification',
      intro:
        payload.detail ?? `Your identity verification has moved to the "${status}" stage.`,
      rows: rows(
        row(LABEL.status, payload.status),
        row(LABEL.reference, payload.reference),
        row(LABEL.when, formatInstant(context.occurredAt)),
        row(LABEL.reason, payload.reason),
      ),
      ...calloutFor(
        'navy',
        'Verification decides which limits and products are open to you, so it is worth finishing in one sitting.',
      ),
      ...actionFor(CTA.viewVerification, payload.actionUrl),
      outro: 'We only ever ask for documents inside the app — never by replying to an email.',
    },
    context,
  );
};

export const disputeUpdate: TemplateRenderer = (context) => {
  const { payload } = context;
  const status = payload.status ?? 'updated';

  return renderEmail(
    `Your dispute is now ${status}`,
    {
      heading: 'Your dispute has moved on',
      intro: payload.detail ?? `The dispute you raised is now at the "${status}" stage.`,
      rows: rows(
        row(LABEL.reference, payload.reference),
        row(LABEL.status, payload.status),
        row(LABEL.amount, moneyText(payload.amount)),
        row(LABEL.merchant, payload.merchant ?? payload.counterparty),
        row(LABEL.when, formatInstant(context.occurredAt)),
      ),
      ...calloutFor(
        'gold',
        'Any provisional credit stays in your balance while we investigate, and may be reversed if the claim is not upheld.',
      ),
      ...actionFor(CTA.viewDispute, payload.actionUrl),
      outro: 'Add evidence at any time from the dispute screen — it speeds the case up.',
    },
    context,
  );
};

export const productUpdate: TemplateRenderer = (context) => {
  const { payload } = context;

  return renderEmail(
    payload.detail === undefined ? `News from ${context.bankName}` : payload.detail,
    {
      heading: `Something new at ${context.bankName}`,
      intro: payload.detail ?? 'We have made a change to your banking that is worth knowing about.',
      rows: rows(row(LABEL.account, payload.accountLabel), row(LABEL.period, payload.period)),
      ...actionFor(CTA.viewUpdate, payload.actionUrl),
      outro: 'You can opt out of product news in your notification preferences at any time.',
    },
    context,
  );
};
