import {
  advanceDisputeRequestSchema,
  attachDisputeEvidenceRequestSchema,
  createDisputeRequestSchema,
  disputeQuerySchema,
  disputeSchema,
} from '../../../src/index.js';
import { idSchema } from '../../../src/common/primitives.js';
import { PAGE_SCHEMAS } from '../components.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

export const disputesOperations = defineOperations([
  {
    method: 'get',
    path: '/disputes',
    tag: TAG.disputes,
    operationId: 'listDisputes',
    summary: 'Disputes, customer-facing or the staff queue by stage',
    query: disputeQuerySchema,
    response: success(STATUS.ok, 'A cursor page of disputes.', PAGE_SCHEMAS.DisputePage),
  },
  {
    method: 'post',
    path: '/disputes',
    tag: TAG.disputes,
    operationId: 'createDispute',
    summary: 'Raise a dispute against a transaction',
    request: createDisputeRequestSchema,
    idempotent: true,
    response: success(STATUS.created, 'The opened dispute.', disputeSchema),
    errors: [
      { status: STATUS.notFound, description: 'The transaction does not exist.' },
      { status: STATUS.conflict, description: 'A dispute on this transaction is already open.' },
      { status: STATUS.unprocessable },
    ],
  },
  {
    method: 'get',
    path: '/disputes/{disputeId}',
    tag: TAG.disputes,
    operationId: 'getDispute',
    summary: 'Dispute detail with evidence and timeline',
    pathParams: { disputeId: idSchema },
    response: success(STATUS.ok, 'The dispute.', disputeSchema),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'post',
    path: '/disputes/{disputeId}/evidence',
    tag: TAG.disputes,
    operationId: 'attachDisputeEvidence',
    summary: 'Attach evidence after the dispute was raised',
    pathParams: { disputeId: idSchema },
    request: attachDisputeEvidenceRequestSchema,
    idempotent: true,
    response: success(STATUS.ok, 'The dispute with the new evidence.', disputeSchema),
    errors: [
      { status: STATUS.notFound },
      { status: STATUS.conflict, description: 'The dispute is already resolved.' },
    ],
  },
  {
    method: 'get',
    path: '/disputes/admin/queue',
    tag: TAG.disputes,
    operationId: 'listDisputeQueue',
    summary: 'The dispute work queue, tightest deadline first (staff)',
    query: disputeQuerySchema,
    response: success(STATUS.ok, 'A cursor page of disputes.', PAGE_SCHEMAS.DisputePage),
  },
  {
    method: 'get',
    path: '/disputes/admin/{disputeId}',
    tag: TAG.disputes,
    operationId: 'getDisputeForStaff',
    summary: 'Dispute detail without the customer scoping (staff)',
    pathParams: { disputeId: idSchema },
    response: success(STATUS.ok, 'The dispute.', disputeSchema),
    errors: [{ status: STATUS.notFound }],
  },
  {
    method: 'post',
    path: '/disputes/{disputeId}/advance',
    tag: TAG.disputes,
    operationId: 'advanceDispute',
    summary: 'Move a dispute to its next stage (staff)',
    pathParams: { disputeId: idSchema },
    request: advanceDisputeRequestSchema,
    response: success(STATUS.ok, 'The advanced dispute.', disputeSchema),
    errors: [
      { status: STATUS.notFound },
      { status: STATUS.conflict },
      { status: STATUS.unprocessable },
    ],
  },
]);
