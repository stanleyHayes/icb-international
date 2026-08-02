import { z } from 'zod';

import * as accountsContract from '../../src/accounts/accounts.contract.js';
import * as adminContract from '../../src/admin/admin.contract.js';
import * as authContract from '../../src/auth/auth.contract.js';
import * as beneficiariesContract from '../../src/beneficiaries/beneficiaries.contract.js';
import * as cardsContract from '../../src/cards/cards.contract.js';
import * as errorsModule from '../../src/common/errors.js';
import * as primitivesModule from '../../src/common/primitives.js';
import { cursorPageSchema, offsetPageSchema } from '../../src/common/pagination.js';
import * as customersContract from '../../src/customers/customers.contract.js';
import * as documentsContract from '../../src/documents/documents.contract.js';
import * as governanceContract from '../../src/governance/governance.contract.js';
import * as kycContract from '../../src/kyc/kyc.contract.js';
import * as loansContract from '../../src/lending/loans.contract.js';
import * as notificationsContract from '../../src/notifications/notifications.contract.js';
import * as paymentsContract from '../../src/payments/payments.contract.js';
import * as productsContract from '../../src/products/products.contract.js';
import * as riskContract from '../../src/risk/risk.contract.js';
import * as savingsContract from '../../src/savings/savings.contract.js';
import * as simulationContract from '../../src/simulation/simulation.contract.js';
import * as supportContract from '../../src/support/support.contract.js';
import * as transactionsContract from '../../src/transactions/transactions.contract.js';
import * as transfersContract from '../../src/transfers/transfers.contract.js';
import {
  amlAlertSchema,
  approvalRequestSchema,
  auditEventSchema,
  beneficiarySchema,
  billerSchema,
  billPaymentSchema,
  cardAuthorisationSchema,
  cardSummarySchema,
  customerAdminViewSchema,
  disputeSchema,
  kycCaseSchema,
  loanApplicationSchema,
  loanSchema,
  monitorEntrySchema,
  notificationSchema,
  riskCaseSchema,
  savingsGoalSchema,
  supportMessageSchema,
  supportTicketSchema,
  transactionSummarySchema,
  transferSummarySchema,
} from '../../src/index.js';

type NamedSchemas = Record<string, z.ZodType>;

const SCHEMA_SUFFIX = 'Schema';
const QUERY_SUFFIX = 'QuerySchema';
const UPPERCASE_INITIAL = /^./;

/** Component keys that should not be derived mechanically from the export name. */
const NAME_OVERRIDES: Readonly<Record<string, string>> = {
  idSchema: 'Ulid',
  documentSchema: 'BankDocument',
  dashboardSchema: 'AdminDashboard',
  scheduleSchema: 'TransferSchedule',
};

/** Every module whose exported schemas become named OpenAPI components. */
const CONTRACT_MODULES: readonly Record<string, unknown>[] = [
  accountsContract,
  adminContract,
  authContract,
  beneficiariesContract,
  cardsContract,
  customersContract,
  documentsContract,
  errorsModule,
  governanceContract,
  kycContract,
  loansContract,
  notificationsContract,
  paymentsContract,
  primitivesModule,
  productsContract,
  riskContract,
  savingsContract,
  simulationContract,
  supportContract,
  transactionsContract,
  transfersContract,
];

/**
 * A schema export becomes a component unless it only ever describes a query string — those
 * are expanded into individual parameters by zod-openapi, and registering the whole object
 * would break that expansion.
 */
function isComponentCandidate(name: string, value: unknown): value is z.ZodType {
  return name.endsWith(SCHEMA_SUFFIX) && !name.endsWith(QUERY_SUFFIX) && value instanceof z.ZodType;
}

/** `registerRequestSchema` → `RegisterRequest`. */
export function toComponentName(exportName: string): string {
  const override = NAME_OVERRIDES[exportName];
  if (override !== undefined) return override;
  const stripped = exportName.slice(0, exportName.length - SCHEMA_SUFFIX.length);
  return stripped.replace(UPPERCASE_INITIAL, (initial) => initial.toUpperCase());
}

/** Code-unit comparison — deterministic across runtimes and locales, unlike a bare `.sort()`. */
function compareNames([left]: [string, z.ZodType], [right]: [string, z.ZodType]): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Builds the `components.schemas` map from the contract modules themselves, so a schema added
 * to `@icb/contracts` is registered here automatically. zod-openapi replaces a schema with a
 * `$ref` wherever the identical object appears, giving PascalCase component names to the
 * generated SDK without touching SDK-01's sources.
 *
 * Entries are sorted by component name: ESM namespace key order is alphabetical while some
 * transpilers preserve source order, and the committed artifact must be byte-identical
 * regardless of which runtime generated it.
 */
export function buildComponentSchemas(): NamedSchemas {
  const entries: [string, z.ZodType][] = [];
  for (const module of CONTRACT_MODULES) {
    for (const [name, value] of Object.entries(module)) {
      if (isComponentCandidate(name, value)) entries.push([toComponentName(name), value]);
    }
  }
  entries.sort(compareNames);
  return Object.fromEntries(entries);
}

/**
 * Named page wrappers. The same object must appear in the route's response for the `$ref`
 * substitution to fire, so route tables import these rather than calling the builders again.
 */
export const PAGE_SCHEMAS = {
  TransactionSummaryPage: cursorPageSchema(transactionSummarySchema),
  TransferSummaryPage: cursorPageSchema(transferSummarySchema),
  BeneficiaryPage: cursorPageSchema(beneficiarySchema),
  CardSummaryPage: cursorPageSchema(cardSummarySchema),
  CardAuthorisationPage: cursorPageSchema(cardAuthorisationSchema),
  LoanPage: cursorPageSchema(loanSchema),
  LoanApplicationPage: cursorPageSchema(loanApplicationSchema),
  SavingsGoalPage: cursorPageSchema(savingsGoalSchema),
  BillerPage: cursorPageSchema(billerSchema),
  BillPaymentPage: cursorPageSchema(billPaymentSchema),
  NotificationPage: cursorPageSchema(notificationSchema),
  SupportTicketPage: cursorPageSchema(supportTicketSchema),
  SupportMessagePage: cursorPageSchema(supportMessageSchema),
  DisputePage: cursorPageSchema(disputeSchema),
  CustomerAdminViewPage: offsetPageSchema(customerAdminViewSchema),
  KycCasePage: offsetPageSchema(kycCaseSchema),
  RiskCasePage: offsetPageSchema(riskCaseSchema),
  AmlAlertPage: offsetPageSchema(amlAlertSchema),
  AuditEventPage: offsetPageSchema(auditEventSchema),
  ApprovalRequestPage: offsetPageSchema(approvalRequestSchema),
  MonitorEntryPage: offsetPageSchema(monitorEntrySchema),
} as const satisfies NamedSchemas;

export function buildAllSchemas(): NamedSchemas {
  return { ...buildComponentSchemas(), ...PAGE_SCHEMAS };
}
