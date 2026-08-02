import { z } from 'zod';

/**
 * Domain vocabularies.
 *
 * Declared as `as const` tuples rather than TypeScript enums so they tree-shake, serialise as
 * plain strings, and can be reused directly as Zod enums and as Mongoose `enum` constraints.
 */

// ---- Customer -------------------------------------------------------------
export const CUSTOMER_TYPES = ['individual', 'business'] as const;
export const CUSTOMER_STATUSES = [
  'prospect',
  'pending_kyc',
  'active',
  'dormant',
  'suspended',
  'closed',
] as const;
export const CUSTOMER_TIERS = ['standard', 'plus', 'premier', 'private'] as const;
export const RISK_RATINGS = ['low', 'medium', 'high', 'prohibited'] as const;

export const customerTypeSchema = z.enum(CUSTOMER_TYPES);
export const customerStatusSchema = z.enum(CUSTOMER_STATUSES);
export const customerTierSchema = z.enum(CUSTOMER_TIERS);
export const riskRatingSchema = z.enum(RISK_RATINGS);

// ---- KYC ------------------------------------------------------------------
export const KYC_LEVELS = ['tier_1', 'tier_2', 'tier_3'] as const;
export const KYC_STATUSES = [
  'not_started',
  'in_progress',
  'pending_review',
  'more_info_required',
  'approved',
  'rejected',
  'expired',
] as const;
export const KYC_DOCUMENT_TYPES = [
  'national_id',
  'passport',
  'drivers_licence',
  'proof_of_address',
  'selfie',
  'business_registration',
  'tax_certificate',
  'board_resolution',
] as const;

export const kycLevelSchema = z.enum(KYC_LEVELS);
export const kycStatusSchema = z.enum(KYC_STATUSES);
export const kycDocumentTypeSchema = z.enum(KYC_DOCUMENT_TYPES);

// ---- Accounts -------------------------------------------------------------
export const ACCOUNT_KINDS = ['current', 'savings', 'fixed_deposit', 'loan', 'card'] as const;
export const ACCOUNT_STATUSES = ['pending', 'active', 'frozen', 'dormant', 'closed'] as const;

export const accountKindSchema = z.enum(ACCOUNT_KINDS);
export const accountStatusSchema = z.enum(ACCOUNT_STATUSES);

// ---- Ledger ---------------------------------------------------------------
export const ENTRY_DIRECTIONS = ['debit', 'credit'] as const;
export const TRANSACTION_STATUSES = [
  'initiated',
  'pending_auth',
  'authorised',
  'posted',
  'settled',
  'declined',
  'rejected',
  'expired',
  'reversed',
] as const;
export const TRANSACTION_TYPES = [
  'transfer_in',
  'transfer_out',
  'card_purchase',
  'card_refund',
  'atm_withdrawal',
  'fee',
  'interest',
  'loan_disbursement',
  'loan_repayment',
  'deposit',
  'withdrawal',
  'reversal',
  'adjustment',
  'fx_conversion',
] as const;

export const entryDirectionSchema = z.enum(ENTRY_DIRECTIONS);
export const transactionStatusSchema = z.enum(TRANSACTION_STATUSES);
export const transactionTypeSchema = z.enum(TRANSACTION_TYPES);

// ---- Transfers ------------------------------------------------------------
export const TRANSFER_RAILS = ['internal', 'on_us', 'ach', 'wire', 'swift'] as const;
export const TRANSFER_STATUSES = [
  'draft',
  'quoted',
  'pending_approval',
  'scheduled',
  'processing',
  'in_settlement',
  'completed',
  'failed',
  'cancelled',
  'returned',
] as const;

export const transferRailSchema = z.enum(TRANSFER_RAILS);
export const transferStatusSchema = z.enum(TRANSFER_STATUSES);

// ---- Cards ----------------------------------------------------------------
export const CARD_KINDS = ['debit', 'credit', 'virtual'] as const;
export const CARD_NETWORKS = ['visa', 'mastercard'] as const;
export const CARD_STATUSES = [
  'requested',
  'issued',
  'active',
  'frozen',
  'lost',
  'stolen',
  'expired',
  'cancelled',
] as const;
export const CARD_CHANNELS = ['online', 'contactless', 'atm', 'international', 'in_store'] as const;

export const cardKindSchema = z.enum(CARD_KINDS);
export const cardNetworkSchema = z.enum(CARD_NETWORKS);
export const cardStatusSchema = z.enum(CARD_STATUSES);
export const cardChannelSchema = z.enum(CARD_CHANNELS);

// ---- Lending --------------------------------------------------------------
export const LOAN_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'approved',
  'declined',
  'offered',
  'active',
  'in_arrears',
  'settled',
  'written_off',
] as const;
export const REPAYMENT_FREQUENCIES = ['weekly', 'fortnightly', 'monthly', 'quarterly'] as const;

export const loanStatusSchema = z.enum(LOAN_STATUSES);
export const repaymentFrequencySchema = z.enum(REPAYMENT_FREQUENCIES);

// ---- Risk & compliance ----------------------------------------------------
export const RISK_DECISIONS = ['allow', 'challenge', 'review', 'block'] as const;
export const ALERT_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export const CASE_STATUSES = ['open', 'investigating', 'escalated', 'closed', 'dismissed'] as const;

export const riskDecisionSchema = z.enum(RISK_DECISIONS);
export const alertSeveritySchema = z.enum(ALERT_SEVERITIES);
export const caseStatusSchema = z.enum(CASE_STATUSES);

// ---- Disputes -------------------------------------------------------------
export const DISPUTE_STAGES = [
  'submitted',
  'investigating',
  'provisional_credit',
  'representment',
  'arbitration',
  'resolved',
] as const;
export const DISPUTE_OUTCOMES = ['upheld', 'rejected', 'partial', 'withdrawn'] as const;

export const disputeStageSchema = z.enum(DISPUTE_STAGES);
export const disputeOutcomeSchema = z.enum(DISPUTE_OUTCOMES);

// ---- Notifications --------------------------------------------------------
export const NOTIFICATION_CHANNELS = ['in_app', 'email', 'sms', 'push'] as const;
export const NOTIFICATION_STATES = [
  'queued',
  'sent',
  'delivered',
  'bounced',
  'complained',
  'failed',
  'suppressed',
] as const;

export const notificationChannelSchema = z.enum(NOTIFICATION_CHANNELS);
export const notificationStateSchema = z.enum(NOTIFICATION_STATES);

// ---- Staff ----------------------------------------------------------------
export const STAFF_ROLES = [
  'support',
  'teller',
  'operations',
  'underwriter',
  'fraud_analyst',
  'aml_officer',
  'compliance',
  'admin',
  'super_admin',
] as const;

export const staffRoleSchema = z.enum(STAFF_ROLES);

export type CustomerType = (typeof CUSTOMER_TYPES)[number];
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];
export type CustomerTier = (typeof CUSTOMER_TIERS)[number];
export type RiskRating = (typeof RISK_RATINGS)[number];
export type KycLevel = (typeof KYC_LEVELS)[number];
export type KycStatus = (typeof KYC_STATUSES)[number];
export type KycDocumentType = (typeof KYC_DOCUMENT_TYPES)[number];
export type AccountKind = (typeof ACCOUNT_KINDS)[number];
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export type EntryDirection = (typeof ENTRY_DIRECTIONS)[number];
export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];
export type TransactionType = (typeof TRANSACTION_TYPES)[number];
export type TransferRail = (typeof TRANSFER_RAILS)[number];
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];
export type CardKind = (typeof CARD_KINDS)[number];
export type CardNetwork = (typeof CARD_NETWORKS)[number];
export type CardStatus = (typeof CARD_STATUSES)[number];
export type CardChannel = (typeof CARD_CHANNELS)[number];
export type LoanStatus = (typeof LOAN_STATUSES)[number];
export type RepaymentFrequency = (typeof REPAYMENT_FREQUENCIES)[number];
export type RiskDecision = (typeof RISK_DECISIONS)[number];
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];
export type CaseStatus = (typeof CASE_STATUSES)[number];
export type DisputeStage = (typeof DISPUTE_STAGES)[number];
export type DisputeOutcome = (typeof DISPUTE_OUTCOMES)[number];
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationState = (typeof NOTIFICATION_STATES)[number];
export type StaffRole = (typeof STAFF_ROLES)[number];
