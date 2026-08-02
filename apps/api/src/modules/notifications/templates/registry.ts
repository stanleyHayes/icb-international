import type { NotificationEvent } from '@icb/contracts';

import { largeTransaction, lowBalance } from './balance.templates.js';
import { cardDeclined, cardTransaction } from './card.templates.js';
import { loanPaymentDue, loanPaymentReceived } from './loan.templates.js';
import { loginNewDevice, securityAlert } from './security.templates.js';
import { disputeUpdate, kycUpdate, productUpdate } from './servicing.templates.js';
import { billDue, statementReady } from './statement.templates.js';
import type { RenderedTemplate, TemplateContext, TemplateRegistry } from './template.types.js';
import { transferFailed, transferReceived, transferSent } from './transfer.templates.js';

/**
 * Every event, exactly one template.
 *
 * The map is typed `Record<NotificationEvent, …>`, so adding an event to the contract fails the
 * build here rather than shipping a customer an empty email at runtime. Lookup is total: there
 * is no default template and no "unknown event" branch to get wrong.
 */
export const TEMPLATES: TemplateRegistry = {
  transfer_sent: transferSent,
  transfer_received: transferReceived,
  transfer_failed: transferFailed,
  card_transaction: cardTransaction,
  card_declined: cardDeclined,
  low_balance: lowBalance,
  large_transaction: largeTransaction,
  statement_ready: statementReady,
  loan_payment_due: loanPaymentDue,
  loan_payment_received: loanPaymentReceived,
  bill_due: billDue,
  security_alert: securityAlert,
  login_new_device: loginNewDevice,
  kyc_update: kycUpdate,
  dispute_update: disputeUpdate,
  product_update: productUpdate,
};

export function renderNotification(
  event: NotificationEvent,
  context: TemplateContext,
): RenderedTemplate {
  return TEMPLATES[event](context);
}
