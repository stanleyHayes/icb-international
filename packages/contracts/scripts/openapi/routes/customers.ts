import { z } from 'zod';

import {
  createCustomerNoteRequestSchema,
  customerAdminViewSchema,
  customerNoteSchema,
  customerProfileSchema,
  customerSearchQuerySchema,
  downloadLinkSchema,
  offsetQuerySchema,
  setCustomerStatusRequestSchema,
  updatePreferencesRequestSchema,
  updateProfileRequestSchema,
} from '../../../src/index.js';
import { idSchema } from '../../../src/common/primitives.js';
import { PAGE_SCHEMAS } from '../components.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

const CUSTOMER_ID = { customerId: idSchema } as const;
const adminCustomerQuerySchema = customerSearchQuerySchema.extend(offsetQuerySchema.shape);

export const customersOperations = defineOperations([
  {
    method: 'get',
    path: '/customers/me',
    tag: TAG.customers,
    operationId: 'getMyProfile',
    summary: 'The authenticated customer’s profile',
    response: success(STATUS.ok, 'The customer’s own profile.', customerProfileSchema),
  },
  {
    method: 'patch',
    path: '/customers/me',
    tag: TAG.customers,
    operationId: 'updateMyProfile',
    summary: 'Update profile details',
    request: updateProfileRequestSchema,
    response: success(STATUS.ok, 'The updated profile.', customerProfileSchema),
    errors: [{ status: STATUS.unprocessable }],
  },
  {
    method: 'patch',
    path: '/customers/me/preferences',
    tag: TAG.customers,
    operationId: 'updateMyPreferences',
    summary: 'Update contact and marketing preferences',
    request: updatePreferencesRequestSchema,
    response: success(STATUS.ok, 'The updated profile.', customerProfileSchema),
    errors: [{ status: STATUS.unprocessable }],
  },
  {
    method: 'post',
    path: '/customers/me/export',
    tag: TAG.customers,
    operationId: 'exportMyData',
    summary: 'Export the customer footprint behind a signed download link',
    response: success(STATUS.ok, 'The expiring download link.', downloadLinkSchema),
  },
  {
    method: 'get',
    path: '/admin/customers',
    tag: TAG.customers,
    operationId: 'searchCustomersForStaff',
    summary: 'Search customers (staff)',
    query: adminCustomerQuerySchema,
    response: success(STATUS.ok, 'Matching customers.', PAGE_SCHEMAS.CustomerAdminViewPage),
  },
  {
    method: 'get',
    path: '/admin/customers/{customerId}',
    tag: TAG.customers,
    operationId: 'getCustomerForStaff',
    summary: 'Customer 360° view (staff)',
    pathParams: CUSTOMER_ID,
    response: success(STATUS.ok, 'The staff view of the customer.', customerAdminViewSchema),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'post',
    path: '/admin/customers/{customerId}/status',
    tag: TAG.customers,
    operationId: 'setCustomerStatusForStaff',
    summary: 'Suspend, reactivate, or close a customer (staff)',
    pathParams: CUSTOMER_ID,
    request: setCustomerStatusRequestSchema,
    response: success(STATUS.ok, 'The updated customer.', customerAdminViewSchema),
    errors: [{ status: STATUS.notFound }, { status: STATUS.conflict }],
  },
  {
    method: 'get',
    path: '/admin/customers/{customerId}/notes',
    tag: TAG.customers,
    operationId: 'listCustomerNotesForStaff',
    summary: 'Internal notes on a customer (staff)',
    pathParams: CUSTOMER_ID,
    response: success(STATUS.ok, 'Notes, newest first.', z.array(customerNoteSchema)),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'post',
    path: '/admin/customers/{customerId}/notes',
    tag: TAG.customers,
    operationId: 'createCustomerNoteForStaff',
    summary: 'Add an internal note (staff)',
    pathParams: CUSTOMER_ID,
    request: createCustomerNoteRequestSchema,
    response: success(STATUS.created, 'The created note.', customerNoteSchema),
    errors: [{ status: STATUS.notFound }, { status: STATUS.unprocessable }],
  },
]);
