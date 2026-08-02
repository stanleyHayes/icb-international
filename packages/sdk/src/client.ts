import { type AuthTokens } from '@icb/contracts';

import { DEFAULT_BASE_URL } from './constants.js';import { createAccountsApi, type AccountsApi } from './endpoints/accounts.js';
import { createAdminApi, type AdminApi } from './endpoints/admin.js';
import { createAmlApi, type AmlApi } from './endpoints/aml.js';
import { createAuthApi, type AuthApi } from './endpoints/auth.js';
import { createBeneficiariesApi, type BeneficiariesApi } from './endpoints/beneficiaries.js';
import { createCardsApi, type CardsApi } from './endpoints/cards.js';
import { createCustomersApi, type CustomersApi } from './endpoints/customers.js';
import { createDisputesApi, type DisputesApi } from './endpoints/disputes.js';
import { createDocumentsApi, type DocumentsApi } from './endpoints/documents.js';
import { createGovernanceApi, type GovernanceApi } from './endpoints/governance.js';
import { createKycApi, type KycApi } from './endpoints/kyc.js';
import { createLoansApi, type LoansApi } from './endpoints/loans.js';
import { createNotificationsApi, type NotificationsApi } from './endpoints/notifications.js';
import { createPaymentsApi, type PaymentsApi } from './endpoints/payments.js';
import { createProductsApi, type ProductsApi } from './endpoints/products.js';
import { createRiskApi, type RiskApi } from './endpoints/risk.js';
import { createSavingsApi, type SavingsApi } from './endpoints/savings.js';
import { createSimulationApi, type SimulationApi } from './endpoints/simulation.js';
import { createSupportApi, type SupportApi } from './endpoints/support.js';
import { createTransactionsApi, type TransactionsApi } from './endpoints/transactions.js';
import { createTransfersApi, type TransfersApi } from './endpoints/transfers.js';
import { type CredentialsMode } from './http.js';
import { type Requester } from './endpoint.js';
import { createRefresher } from './refresh.js';
import { stripTrailingSlashes } from './query.js';
import { createRequester, type AccessTokenProvider } from './transport.js';

export interface IcbClientOptions {
  /** API origin, e.g. `https://api.icb.example`. Defaults to the local dev API. */
  baseUrl?: string;
  /** Returns the current access token; awaited before every authenticated request. */
  getAccessToken?: AccessTokenProvider;
  /** Persist the rotated tokens after an automatic refresh. */
  onTokensRefreshed?: (tokens: AuthTokens) => void;
  /** Inject a fetch implementation (tests, custom agents). Defaults to global `fetch`. */
  fetchFn?: typeof fetch;
  /** Cookie behaviour for the refresh call; `include` suits same-site cookie auth. */
  credentials?: CredentialsMode;
}

export interface IcbClient {
  auth: AuthApi;
  customers: CustomersApi;
  kyc: KycApi;
  accounts: AccountsApi;
  transactions: TransactionsApi;
  transfers: TransfersApi;
  beneficiaries: BeneficiariesApi;
  cards: CardsApi;
  loans: LoansApi;
  savings: SavingsApi;
  payments: PaymentsApi;
  risk: RiskApi;
  aml: AmlApi;
  disputes: DisputesApi;
  products: ProductsApi;
  documents: DocumentsApi;
  notifications: NotificationsApi;
  support: SupportApi;
  governance: GovernanceApi;
  admin: AdminApi;
  simulation: SimulationApi;
}

/**
 * Creates the typed ICB API client. Works in the browser and in Node (Next.js RSC and server
 * actions) — the only environment dependency is `fetch`.
 */
export function createIcbClient(options: IcbClientOptions = {}): IcbClient {
  const baseUrl = stripTrailingSlashes(options.baseUrl ?? DEFAULT_BASE_URL);
  const fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
  const credentials = options.credentials ?? 'include';
  const refresher = createRefresher({
    baseUrl,
    fetchFn,
    credentials,
    onTokensRefreshed: options.onTokensRefreshed,
  });
  const call = createRequester({
    baseUrl,
    fetchFn,
    credentials,
    getAccessToken: options.getAccessToken,
    refresher,
  });
  return buildNamespaces(call);
}

function buildNamespaces(call: Requester): IcbClient {
  return {
    auth: createAuthApi(call),
    customers: createCustomersApi(call),
    kyc: createKycApi(call),
    accounts: createAccountsApi(call),
    transactions: createTransactionsApi(call),
    transfers: createTransfersApi(call),
    beneficiaries: createBeneficiariesApi(call),
    cards: createCardsApi(call),
    loans: createLoansApi(call),
    savings: createSavingsApi(call),
    payments: createPaymentsApi(call),
    risk: createRiskApi(call),
    aml: createAmlApi(call),
    disputes: createDisputesApi(call),
    products: createProductsApi(call),
    documents: createDocumentsApi(call),
    notifications: createNotificationsApi(call),
    support: createSupportApi(call),
    governance: createGovernanceApi(call),
    admin: createAdminApi(call),
    simulation: createSimulationApi(call),
  };
}
