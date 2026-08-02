/**
 * `@icb/contracts` — the single source of truth for every shape that crosses the API boundary.
 *
 * Rules:
 *  1. Nothing here imports from `apps/`. The contract does not know who implements it.
 *  2. A backend DTO and a frontend type are never declared separately; both come from here.
 *  3. Adding or changing a schema is a deliberate, announced change (agent_plan.md §9.5).
 */

export * from './common/primitives.js';
export * from './common/errors.js';
export * from './common/pagination.js';
export * from './common/enums.js';

export * from './auth/auth.contract.js';
export * from './customers/customers.contract.js';
export * from './kyc/kyc.contract.js';
export * from './accounts/accounts.contract.js';
export * from './transactions/transactions.contract.js';
export * from './transfers/transfers.contract.js';
export * from './beneficiaries/beneficiaries.contract.js';
export * from './cards/cards.contract.js';
export * from './lending/loans.contract.js';
export * from './savings/savings.contract.js';
export * from './payments/payments.contract.js';
export * from './risk/risk.contract.js';
export * from './products/products.contract.js';
export * from './documents/documents.contract.js';
export * from './notifications/notifications.contract.js';
export * from './support/support.contract.js';
export * from './governance/governance.contract.js';
export * from './admin/admin.contract.js';
export * from './simulation/simulation.contract.js';
