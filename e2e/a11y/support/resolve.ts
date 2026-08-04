import { apiGet, apiPost, asItems, ApiRequestError } from './api';
import { firstId, withMongo } from './mongo';

/**
 * Dynamic-route param resolution.
 *
 * Client routes need entities OWNED by the demo customer (ownership is re-checked
 * server-side, so a random id 404s). The seed only creates accounts, one card, transfers
 * and a KYC case, so the bootstrap creates one fixture per empty collection — best
 * effort, additive, idempotent across runs. Admin routes need any existing document and
 * are resolved straight from Mongo.
 *
 * Unresolvable params map to null; the scan specs skip those routes with a message and
 * the skips are counted in the final report.
 */

export type ResolvedIds = Record<string, string | null>;

const money = (minorUnits: number) => ({ minorUnits, currency: 'USD', scale: 2 });

async function firstItemId(
  token: string,
  path: string,
  create?: { path: string; body: Record<string, unknown> },
): Promise<string | null> {
  try {
    const existing = asItems(await apiGet<unknown>(path, token));
    if (existing.length > 0 && typeof existing[0]['id'] === 'string') {
      return existing[0]['id'];
    }
    if (!create) {
      return null;
    }
    const created = await apiPost<Record<string, unknown>>(create.path, token, create.body);
    return typeof created['id'] === 'string' ? created['id'] : null;
  } catch (error) {
    const detail = error instanceof ApiRequestError ? error.message : String(error);
    console.warn(`[a11y] fixture unavailable for ${path}: ${detail}`);
    return null;
  }
}

export async function resolveClientIds(token: string): Promise<ResolvedIds> {
  const accounts = asItems(await apiGet<unknown>('/accounts', token));
  const accountId = typeof accounts[0]?.['id'] === 'string' ? accounts[0]['id'] : null;
  const savingsAccountId =
    typeof accounts.find((a) => a['kind'] === 'savings')?.['id'] === 'string'
      ? (accounts.find((a) => a['kind'] === 'savings')?.['id'] as string)
      : accountId;

  const billers = asItems(await apiGet<unknown>('/billers', token).catch(() => []));
  const billerId = typeof billers[0]?.['id'] === 'string' ? billers[0]['id'] : null;

  const ids: ResolvedIds = {
    '/accounts/{accountId}': accountId,
    '/cards/{cardId}': await firstItemId(token, '/cards'),
    '/transactions/{transactionId}': await firstItemId(token, '/transactions?limit=1'),
    '/transfer/{transferId}': await firstItemId(token, '/transfers?limit=1'),
    '/beneficiaries/{beneficiaryId}': await firstItemId(token, '/beneficiaries', {
      path: '/beneficiaries',
      body: {
        name: 'A11y Probe Beneficiary',
        destination: {
          kind: 'domestic_bank',
          accountNumber: '12345678',
          sortCode: '12-34-56',
          accountHolderName: 'A11y Probe Beneficiary',
        },
        favourite: false,
      },
    }),
    '/savings/goals/{goalId}': savingsAccountId
      ? await firstItemId(token, '/savings/goals', {
          path: '/savings/goals',
          body: { accountId: savingsAccountId, name: 'A11y probe goal', target: money(100_000) },
        })
      : null,
    '/savings/deposits/{depositId}': accountId
      ? await firstItemId(token, '/savings/deposits', {
          path: '/savings/deposits',
          body: { fromAccountId: accountId, principal: money(100_000), termMonths: 12 },
        })
      : null,
    '/bills/{billId}': billerId
      ? await firstItemId(token, '/bills', {
          path: '/bills',
          // The seeded billers' reference patterns accept a 10-digit meter/account number.
          body: { billerId, customerReference: '1234567890', nickname: 'A11y probe bill' },
        })
      : null,
    '/support/tickets/{ticketId}': await firstItemId(token, '/support/tickets', {
      path: '/support/tickets',
      body: {
        subject: 'A11y automation probe ticket',
        category: 'technical',
        body: 'Created by the a11y suite so the ticket detail route has something to render.',
      },
    }),
    '/loans/applications/{applicationId}': accountId
      ? await firstItemId(token, '/loans/applications', {
          path: '/loans/applications',
          body: {
            productCode: 'PERSONAL_STANDARD',
            amount: money(500_000),
            termMonths: 24,
            purpose: 'other',
            disbursementAccountId: accountId,
            repaymentAccountId: accountId,
            declaredMonthlyIncome: money(800_000),
            declaredMonthlyExpenses: money(200_000),
            existingCommitments: money(50_000),
          },
        })
      : null,
    '/loans/{loanId}': await firstItemId(token, '/loans'),
    '/support/disputes/{disputeId}': await firstItemId(token, '/disputes'),
  };
  return ids;
}

const ADMIN_COLLECTIONS: Record<string, { collection: string; field?: string }> = {
  '/accounts/{accountId}': { collection: 'accounts' },
  '/aml/{alertId}': { collection: 'aml_alerts' },
  '/approvals/{approvalId}': { collection: 'approval_requests' },
  '/cards/{cardId}': { collection: 'cards' },
  '/customers/{customerId}': { collection: 'customers' },
  '/disputes/{disputeId}': { collection: 'disputes' },
  '/fraud/{caseId}': { collection: 'risk_cases' },
  '/kyc/{caseId}': { collection: 'kyc_cases' },
  '/loans/{loanId}': { collection: 'loans' },
  '/loans/applications/{applicationId}': { collection: 'loan_applications' },
  '/products/{productCode}': { collection: 'products', field: 'code' },
  '/staff/{staffId}': { collection: 'staff_users' },
  '/support/{ticketId}': { collection: 'support_tickets' },
};

export async function resolveAdminIds(): Promise<ResolvedIds> {
  return withMongo(async (client) => {
    const ids: ResolvedIds = {};
    for (const [route, source] of Object.entries(ADMIN_COLLECTIONS)) {
      ids[route] = await firstId(client, source.collection, source.field ?? '_id');
    }
    return ids;
  });
}
