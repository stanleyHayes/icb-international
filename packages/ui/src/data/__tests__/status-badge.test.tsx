import {
  ACCOUNT_STATUSES,
  approvalRequestSchema,
  beneficiaryVerificationSchema,
  billPaymentSchema,
  CARD_STATUSES,
  cardAuthorisationSchema,
  CASE_STATUSES,
  CUSTOMER_STATUSES,
  DISPUTE_OUTCOMES,
  DISPUTE_STAGES,
  KYC_STATUSES,
  kycDocumentSchema,
  LOAN_STATUSES,
  NOTIFICATION_STATES,
  repaymentInstalmentSchema,
  RISK_DECISIONS,
  savingsGoalSchema,
  scenarioRunSchema,
  standingOrderSchema,
  supportTicketSchema,
  systemHealthSchema,
  termDepositSchema,
  TRANSACTION_STATUSES,
  TRANSFER_STATUSES,
} from '@icb/contracts';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { StatusBadge } from '../status-badge';
import { STATUS_TONES, statusLabel, statusTone } from '../status-badge.constants';

/**
 * Every status enum exported by @icb/contracts. Inline `z.enum` status fields are read from the
 * schemas themselves, so a new value added to the contract fails this test until it is mapped.
 */
const CONTRACT_STATUS_ENUMS: Record<string, readonly string[]> = {
  CUSTOMER_STATUSES,
  KYC_STATUSES,
  ACCOUNT_STATUSES,
  TRANSACTION_STATUSES,
  TRANSFER_STATUSES,
  CARD_STATUSES,
  LOAN_STATUSES,
  CASE_STATUSES,
  DISPUTE_STAGES,
  DISPUTE_OUTCOMES,
  NOTIFICATION_STATES,
  RISK_DECISIONS,
};

const INLINE_STATUS_ENUMS: Record<string, readonly string[]> = {
  billPayment: billPaymentSchema.shape.status.options,
  savingsGoal: savingsGoalSchema.shape.status.options,
  termDeposit: termDepositSchema.shape.status.options,
  kycDocument: kycDocumentSchema.shape.status.options,
  cardAuthorisation: cardAuthorisationSchema.shape.status.options,
  beneficiaryVerification: beneficiaryVerificationSchema.shape.state.options,
  systemHealth: systemHealthSchema.shape.status.options,
  scenarioRun: scenarioRunSchema.shape.status.options,
  repaymentInstalment: repaymentInstalmentSchema.shape.status.options,
  supportTicket: supportTicketSchema.shape.status.options,
  approvalRequest: approvalRequestSchema.shape.status.options,
  standingOrder: standingOrderSchema.shape.status.options,
};

describe('StatusBadge tone map audit', () => {
  it.each(Object.entries(CONTRACT_STATUS_ENUMS))('maps every value of %s', (_name, values) => {
    for (const value of values) {
      expect(STATUS_TONES, `unmapped status: ${value}`).toHaveProperty(value);
    }
  });

  it.each(Object.entries(INLINE_STATUS_ENUMS))('maps every value of %s', (_name, values) => {
    for (const value of values) {
      expect(STATUS_TONES, `unmapped status: ${value}`).toHaveProperty(value);
    }
  });
});

describe('StatusBadge', () => {
  it('renders a humanised label and the tone class', () => {
    const html = renderToStaticMarkup(<StatusBadge status="pending_kyc" />);
    expect(html).toContain('pending kyc');
    expect(html).toContain('--icb-gold-50');
  });

  it('degrades unknown statuses to neutral instead of throwing', () => {
    expect(statusTone('something_new')).toBe('neutral');
    const html = renderToStaticMarkup(<StatusBadge status="something_new" />);
    expect(html).toContain('--icb-slate-100');
  });

  it('turns snake_case into words', () => {
    expect(statusLabel('in_settlement')).toBe('in settlement');
  });
});
