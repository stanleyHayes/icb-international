import { type EndpointDef } from '../endpoint.js';
import { accountsEndpoints } from './accounts.js';
import { adminEndpoints } from './admin.js';
import { amlEndpoints } from './aml.js';
import { authEndpoints } from './auth.js';
import { beneficiariesEndpoints } from './beneficiaries.js';
import { budgetsEndpoints } from './budgets.js';
import { cardsEndpoints } from './cards.js';
import { chatEndpoints } from './chat.js';
import { contentEndpoints } from './content.js';
import { customersEndpoints } from './customers.js';
import { disputesEndpoints } from './disputes.js';
import { documentsEndpoints } from './documents.js';
import { governanceEndpoints } from './governance.js';
import { kycEndpoints } from './kyc.js';
import { loansEndpoints } from './loans.js';
import { notificationsEndpoints } from './notifications.js';
import { paymentsEndpoints } from './payments.js';
import { productsEndpoints } from './products.js';
import { riskEndpoints } from './risk.js';
import { savingsEndpoints } from './savings.js';
import { simulationEndpoints } from './simulation.js';
import { supportEndpoints } from './support.js';
import { systemEndpoints } from './system.js';
import { transactionsEndpoints } from './transactions.js';
import { transfersEndpoints } from './transfers.js';

/**
 * Every endpoint in the API, grouped by bounded context. The client turns each entry into a
 * typed method; `@icb/sdk/mock` turns each into an MSW handler. This registry is the single
 * source of truth for the API surface — add an endpoint here, never ad hoc.
 */
export const endpointRegistry = {
  auth: authEndpoints,
  customers: customersEndpoints,
  kyc: kycEndpoints,
  accounts: accountsEndpoints,
  transactions: transactionsEndpoints,
  transfers: transfersEndpoints,
  beneficiaries: beneficiariesEndpoints,
  budgets: budgetsEndpoints,
  cards: cardsEndpoints,
  loans: loansEndpoints,
  savings: savingsEndpoints,
  payments: paymentsEndpoints,
  risk: riskEndpoints,
  aml: amlEndpoints,
  disputes: disputesEndpoints,
  products: productsEndpoints,
  content: contentEndpoints,
  documents: documentsEndpoints,
  notifications: notificationsEndpoints,
  support: supportEndpoints,
  chat: chatEndpoints,
  governance: governanceEndpoints,
  admin: adminEndpoints,
  simulation: simulationEndpoints,
  system: systemEndpoints,
} as const satisfies Record<string, Record<string, EndpointDef>>;

export type EndpointRegistry = typeof endpointRegistry;
