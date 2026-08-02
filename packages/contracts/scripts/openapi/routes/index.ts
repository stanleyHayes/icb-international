import type { OperationSpec } from '../spec.js';
import { accountsOperations } from './accounts.js';
import { adminOperations } from './admin.js';
import { authOperations } from './auth.js';
import { beneficiariesOperations } from './beneficiaries.js';
import { cardsOperations } from './cards.js';
import { customersOperations } from './customers.js';
import { disputesOperations } from './disputes.js';
import { documentsOperations } from './documents.js';
import { governanceOperations } from './governance.js';
import { kycOperations } from './kyc.js';
import { loansOperations } from './loans.js';
import { notificationsOperations } from './notifications.js';
import { paymentsOperations } from './payments.js';
import { productsOperations } from './products.js';
import { riskOperations } from './risk.js';
import { savingsOperations } from './savings.js';
import { simulationOperations } from './simulation.js';
import { supportOperations } from './support.js';
import { systemOperations } from './system.js';
import { transactionsOperations } from './transactions.js';
import { transfersOperations } from './transfers.js';

/** Every operation in the API, grouped by bounded context, alphabetically by module. */
export const ALL_OPERATIONS: readonly OperationSpec[] = [
  ...accountsOperations,
  ...adminOperations,
  ...authOperations,
  ...beneficiariesOperations,
  ...cardsOperations,
  ...customersOperations,
  ...disputesOperations,
  ...documentsOperations,
  ...governanceOperations,
  ...kycOperations,
  ...loansOperations,
  ...notificationsOperations,
  ...paymentsOperations,
  ...productsOperations,
  ...riskOperations,
  ...savingsOperations,
  ...simulationOperations,
  ...supportOperations,
  ...systemOperations,
  ...transactionsOperations,
  ...transfersOperations,
];
