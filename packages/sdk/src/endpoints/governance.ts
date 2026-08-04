import { z } from 'zod';
import {
  approvalInboxQuerySchema,
  approvalRequestSchema,
  auditEventSchema,
  auditIntegritySchema,
  auditQuerySchema,
  createStaffUserRequestSchema,
  decideApprovalRequestSchema,
  offsetPageSchema,
  staffUserSchema,
} from '@icb/contracts';

import { get, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const governanceEndpoints = {
  listStaff: get('/admin/staff', z.array(staffUserSchema)),
  getStaff: get('/admin/staff/:staffId', staffUserSchema),
  createStaff: post('/admin/staff', staffUserSchema, { body: createStaffUserRequestSchema }),
  listAuditEvents: get('/admin/audit/events', offsetPageSchema(auditEventSchema), {
    query: auditQuerySchema,
  }),
  verifyAuditIntegrity: get('/admin/audit/integrity', auditIntegritySchema),
  listApprovals: get('/admin/approvals', z.array(approvalRequestSchema), {
    query: approvalInboxQuerySchema,
  }),
  getApproval: get('/admin/approvals/:approvalId', approvalRequestSchema),
  decideApproval: post('/admin/approvals/:approvalId/decision', approvalRequestSchema, {
    body: decideApprovalRequestSchema,
  }),
};

export function createGovernanceApi(call: Requester) {
  return {
    listStaff: (options?: RequestOptions) => call(governanceEndpoints.listStaff, { options }),
    getStaff: (staffId: string, options?: RequestOptions) =>
      call(governanceEndpoints.getStaff, { params: { staffId }, options }),
    createStaff: (body: z.input<typeof createStaffUserRequestSchema>, options?: RequestOptions) =>
      call(governanceEndpoints.createStaff, { body, options }),
    listAuditEvents: (query?: z.input<typeof auditQuerySchema>, options?: RequestOptions) =>
      call(governanceEndpoints.listAuditEvents, { query, options }),
    verifyAuditIntegrity: (options?: RequestOptions) =>
      call(governanceEndpoints.verifyAuditIntegrity, { options }),
    listApprovals: (query?: z.input<typeof approvalInboxQuerySchema>, options?: RequestOptions) =>
      call(governanceEndpoints.listApprovals, { query, options }),
    getApproval: (approvalId: string, options?: RequestOptions) =>
      call(governanceEndpoints.getApproval, { params: { approvalId }, options }),
    decideApproval: (
      approvalId: string,
      body: z.input<typeof decideApprovalRequestSchema>,
      options?: RequestOptions,
    ) => call(governanceEndpoints.decideApproval, { params: { approvalId }, body, options }),
  };
}

export type GovernanceApi = ReturnType<typeof createGovernanceApi>;
