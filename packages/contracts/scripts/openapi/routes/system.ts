import {
  ledgerIntegrityReportSchema,
  liveHealthSchema,
  readinessHealthSchema,
} from '../../../src/index.js';
import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

export const systemOperations = defineOperations([
  {
    method: 'get',
    path: '/health',
    tag: TAG.system,
    operationId: 'healthCheck',
    summary: 'Liveness probe',
    auth: false,
    response: success(STATUS.ok, 'The process is alive.', liveHealthSchema),
  },
  {
    method: 'get',
    path: '/health/ready',
    tag: TAG.system,
    operationId: 'readinessCheck',
    summary: 'Readiness probe — database and cache reachable',
    auth: false,
    response: success(STATUS.ok, 'The service can take traffic.', readinessHealthSchema),
    errors: [{ status: STATUS.serviceUnavailable, description: 'A required dependency is down.' }],
  },
  {
    method: 'get',
    path: '/health/ledger',
    tag: TAG.system,
    operationId: 'ledgerHealthCheck',
    summary: 'Cached ledger-integrity health for operators and probes',
    auth: false,
    response: success(STATUS.ok, 'The latest ledger integrity report.', ledgerIntegrityReportSchema),
  },
]);
