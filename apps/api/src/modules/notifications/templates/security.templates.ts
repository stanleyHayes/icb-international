import { actionFor, calloutFor, renderEmail, row, rows } from './email-block.js';
import { CTA, FALLBACK, LABEL, SECURITY_OUTRO } from './labels.js';
import type { TemplateRenderer } from './template.types.js';
import { formatInstant } from './theme.js';

/**
 * Security mail.
 *
 * These two are the templates a customer reads with their guard up, so they carry no marketing,
 * no amount, and one action: check what happened. The anti-phishing line in the footer is on
 * every ICB email precisely so that its absence is a signal.
 */

export const securityAlert: TemplateRenderer = (context) => {
  const { payload } = context;

  return renderEmail(
    `Security alert on your ${context.bankName} account`,
    {
      heading: 'We noticed something worth checking',
      intro:
        payload.detail ??
        'We spotted activity on your account that does not match your usual pattern.',
      rows: rows(
        row(LABEL.status, payload.status),
        row(LABEL.device, payload.device),
        row(LABEL.location, payload.location),
        row(LABEL.when, formatInstant(context.occurredAt)),
        row(LABEL.reason, payload.reason),
      ),
      ...calloutFor(
        'danger',
        'If you did not do this, change your password and revoke your other sessions now. This alert cannot be turned off.',
      ),
      ...actionFor(CTA.reviewSecurity, payload.actionUrl),
      outro: SECURITY_OUTRO,
    },
    context,
  );
};

export const loginNewDevice: TemplateRenderer = (context) => {
  const { payload } = context;
  const device = payload.device ?? FALLBACK.device;

  return renderEmail(
    `New sign-in from ${device}`,
    {
      heading: 'A new device signed in',
      intro: `Your account was accessed from ${device}${payload.location === undefined ? '' : ` in ${payload.location}`}.`,
      rows: rows(
        row(LABEL.device, payload.device),
        row(LABEL.location, payload.location),
        row(LABEL.when, formatInstant(context.occurredAt)),
      ),
      ...calloutFor(
        'navy',
        'If this was you, no action is needed — we will not ask again from this device.',
      ),
      ...actionFor(CTA.reviewSecurity, payload.actionUrl),
      outro: SECURITY_OUTRO,
    },
    context,
  );
};
