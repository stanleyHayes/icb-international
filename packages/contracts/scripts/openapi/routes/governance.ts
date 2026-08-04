import { z } from 'zod';

import {
  approvalInboxQuerySchema,
  approvalRequestSchema,
  auditIntegritySchema,
  auditQuerySchema,
  createStaffUserRequestSchema,
  decideApprovalRequestSchema,
  staffUserSchema,
} from '../../../src/index.js';
import { idSchema } from '../../../src/common/primitives.js';
import { PAGE_SCHEMAS } from '../components.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

export const governanceOperations = defineOperations([
  {
    method: 'get',
    path: '/admin/staff',
    tag: TAG.governance,
    operationId: 'listStaffUsers',
    summary: 'Staff users and their roles (admin)',
    response: success(STATUS.ok, 'All staff users.', z.array(staffUserSchema)),
  },
  {
    method: 'get',
    path: '/admin/staff/{staffId}',
    tag: TAG.governance,
    operationId: 'getStaffUser',
    summary: 'One staff user with roles and MFA state (admin)',
    pathParams: { staffId: idSchema },
    response: success(STATUS.ok, 'The staff user.', staffUserSchema),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'post',
    path: '/admin/staff',
    tag: TAG.governance,
    operationId: 'createStaffUser',
    summary: 'Provision a staff user (admin)',
    request: createStaffUserRequestSchema,
    response: success(STATUS.created, 'The provisioned staff user.', staffUserSchema),
    errors: [
      { status: STATUS.conflict, description: 'A staff user with this email already exists.' },
      { status: STATUS.unprocessable },
    ],
  },
  {
    method: 'get',
    path: '/admin/audit/events',
    tag: TAG.governance,
    operationId: 'searchAuditEvents',
    summary: 'Search the append-only audit trail (staff)',
    query: auditQuerySchema,
    response: success(STATUS.ok, 'An offset page of audit events.', PAGE_SCHEMAS.AuditEventPage),
  },
  {
    method: 'get',
    path: '/admin/audit/integrity',
    tag: TAG.governance,
    operationId: 'verifyAuditIntegrity',
    summary: 'Verify the audit hash chain (staff)',
    response: success(STATUS.ok, 'The verification result.', auditIntegritySchema),
  },
  {
    method: 'get',
    path: '/admin/approvals',
    tag: TAG.governance,
    operationId: 'listApprovals',
    summary: 'The maker-checker inbox (staff)',
    query: approvalInboxQuerySchema,
    response: success(STATUS.ok, 'The approval queue.', z.array(approvalRequestSchema)),
  },
  {
    method: 'get',
    path: '/admin/approvals/{approvalId}',
    tag: TAG.governance,
    operationId: 'getApproval',
    summary: 'One approval request with its payload and decision state',
    pathParams: { approvalId: idSchema },
    response: success(STATUS.ok, 'The approval request.', approvalRequestSchema),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'post',
    path: '/admin/approvals/{approvalId}/decision',
    tag: TAG.governance,
    operationId: 'decideApproval',
    summary: 'Approve or reject (four-eyes; self-approval blocked)',
    pathParams: { approvalId: idSchema },
    request: decideApprovalRequestSchema,
    response: success(STATUS.ok, 'The decided request.', approvalRequestSchema),
    errors: [
      { status: STATUS.notFound },
      { status: STATUS.forbidden, description: 'The requester may not approve their own request.' },
      { status: STATUS.conflict, description: 'Already decided or expired.' },
    ],
  },
]);
