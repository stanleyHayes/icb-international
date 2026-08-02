import { z } from 'zod';

import { STATUS, TAG } from '../constants.js';
import { defineOperations, success } from '../spec.js';

const healthStatusSchema = z.object({
  status: z.enum(['ok', 'ready', 'degraded']),
});

export const systemOperations = defineOperations([
  {
    method: 'get',
    path: '/health',
    tag: TAG.system,
    operationId: 'healthCheck',
    summary: 'Liveness probe',
    auth: false,
    response: success(STATUS.ok, 'The process is alive.', healthStatusSchema),
  },
  {
    method: 'get',
    path: '/health/ready',
    tag: TAG.system,
    operationId: 'readinessCheck',
    summary: 'Readiness probe — database and cache reachable',
    auth: false,
    response: success(STATUS.ok, 'The service can take traffic.', healthStatusSchema),
    errors: [{ status: STATUS.serviceUnavailable, description: 'A required dependency is down.' }],
  },
]);
