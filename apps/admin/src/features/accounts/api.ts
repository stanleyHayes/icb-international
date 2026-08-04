import 'server-only';

import type {
  AccountDetail,
  BalanceHistory,
  CustomerAdminView,
  Hold,
  OffsetPage,
  Product,
} from '@icb/contracts';

import { api } from '@/lib/api';

/**
 * Staff-side account reads.
 *
 * `searchCustomers` and `listProducts` are live API routes. The account-scoped reads mirror the
 * existing `POST /admin/accounts/:accountId/*` mutations and the customer-scoped shapes — they
 * are the natural staff counterparts the console needs, tracked as backend contract requests.
 */
export function searchCustomers(query: string): Promise<OffsetPage<CustomerAdminView>> {
  const params = new URLSearchParams({ q: query, limit: '10' });
  return api<OffsetPage<CustomerAdminView>>(`/admin/customers?${params.toString()}`);
}

export function getAccount(accountId: string): Promise<AccountDetail> {
  return api<AccountDetail>(`/admin/accounts/${accountId}`);
}

export function getBalanceHistory(accountId: string): Promise<BalanceHistory> {
  return api<BalanceHistory>(`/admin/accounts/${accountId}/balance-history`);
}

export function getHolds(accountId: string): Promise<Hold[]> {
  return api<Hold[]>(`/admin/accounts/${accountId}/holds`);
}

export function listProducts(): Promise<Product[]> {
  return api<Product[]>('/admin/products');
}
