import {
  ledgerIntegrityReportSchema,
  liveHealthSchema,
  readinessHealthSchema,
} from '@icb/contracts';

import { get, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const systemEndpoints = {
  health: get('/health', liveHealthSchema, { auth: false }),
  readiness: get('/health/ready', readinessHealthSchema, { auth: false }),
  ledger: get('/health/ledger', ledgerIntegrityReportSchema, { auth: false }),
};

export function createSystemApi(call: Requester) {
  return {
    health: (options?: RequestOptions) => call(systemEndpoints.health, { options }),
    readiness: (options?: RequestOptions) => call(systemEndpoints.readiness, { options }),
    ledger: (options?: RequestOptions) => call(systemEndpoints.ledger, { options }),
  };
}

export type SystemApi = ReturnType<typeof createSystemApi>;
