import { z } from 'zod';
import {
  createCustomerNoteRequestSchema,
  customerAdminViewSchema,
  customerNoteSchema,
  customerProfileSchema,
  customerSearchQuerySchema,
  downloadLinkSchema,
  offsetQuerySchema,
  offsetPageSchema,
  setCustomerStatusRequestSchema,
  updatePreferencesRequestSchema,
  updateProfileRequestSchema,
} from '@icb/contracts';

import { get, patch, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

const adminCustomerQuerySchema = customerSearchQuerySchema.extend(offsetQuerySchema.shape);

export const customersEndpoints = {
  me: get('/customers/me', customerProfileSchema),
  updateMe: patch('/customers/me', customerProfileSchema, { body: updateProfileRequestSchema }),
  updatePreferences: patch('/customers/me/preferences', customerProfileSchema, {
    body: updatePreferencesRequestSchema,
  }),
  exportData: post('/customers/me/export', downloadLinkSchema, {}),
  adminSearch: get('/admin/customers', offsetPageSchema(customerAdminViewSchema), {
    query: adminCustomerQuerySchema,
  }),
  adminGet: get('/admin/customers/:customerId', customerAdminViewSchema),
  adminSetStatus: post('/admin/customers/:customerId/status', customerAdminViewSchema, {
    body: setCustomerStatusRequestSchema,
  }),
  adminListNotes: get('/admin/customers/:customerId/notes', z.array(customerNoteSchema)),
  adminCreateNote: post('/admin/customers/:customerId/notes', customerNoteSchema, {
    body: createCustomerNoteRequestSchema,
  }),
};

export function createCustomersApi(call: Requester) {
  return {
    me: (options?: RequestOptions) => call(customersEndpoints.me, { options }),
    updateMe: (body: z.input<typeof updateProfileRequestSchema>, options?: RequestOptions) =>
      call(customersEndpoints.updateMe, { body, options }),
    updatePreferences: (
      body: z.input<typeof updatePreferencesRequestSchema>,
      options?: RequestOptions,
    ) => call(customersEndpoints.updatePreferences, { body, options }),
    exportData: (options?: RequestOptions) => call(customersEndpoints.exportData, { options }),
    adminSearch: (query?: z.input<typeof adminCustomerQuerySchema>, options?: RequestOptions) =>
      call(customersEndpoints.adminSearch, { query, options }),
    adminGet: (customerId: string, options?: RequestOptions) =>
      call(customersEndpoints.adminGet, { params: { customerId }, options }),
    adminSetStatus: (
      customerId: string,
      body: z.input<typeof setCustomerStatusRequestSchema>,
      options?: RequestOptions,
    ) => call(customersEndpoints.adminSetStatus, { params: { customerId }, body, options }),
    adminListNotes: (customerId: string, options?: RequestOptions) =>
      call(customersEndpoints.adminListNotes, { params: { customerId }, options }),
    adminCreateNote: (
      customerId: string,
      body: z.input<typeof createCustomerNoteRequestSchema>,
      options?: RequestOptions,
    ) => call(customersEndpoints.adminCreateNote, { params: { customerId }, body, options }),
  };
}

export type CustomersApi = ReturnType<typeof createCustomersApi>;
