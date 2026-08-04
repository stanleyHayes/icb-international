import { type z } from 'zod';
import {
  offsetPageSchema,
  resolveRiskCaseRequestSchema,
  riskCaseQuerySchema,
  riskCaseSchema,
  riskRuleListResponseSchema,
  riskRuleSchema,
  updateRiskRuleRequestSchema,
} from '@icb/contracts';

import { get, patch, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const riskEndpoints = {
  listRules: get('/risk/rules', riskRuleListResponseSchema),
  updateRule: patch('/risk/rules/:ruleId', riskRuleSchema, {
    body: updateRiskRuleRequestSchema,
  }),
  listCases: get('/risk/cases', offsetPageSchema(riskCaseSchema), {
    query: riskCaseQuerySchema,
  }),
  getCase: get('/risk/cases/:caseId', riskCaseSchema),
  assignCase: post('/risk/cases/:caseId/assign', riskCaseSchema, {}),
  resolveCase: post('/risk/cases/:caseId/resolve', riskCaseSchema, {
    body: resolveRiskCaseRequestSchema,
  }),
};

export function createRiskApi(call: Requester) {
  return {
    listRules: (options?: RequestOptions) => call(riskEndpoints.listRules, { options }),
    updateRule: (
      ruleId: string,
      body: z.input<typeof updateRiskRuleRequestSchema>,
      options?: RequestOptions,
    ) => call(riskEndpoints.updateRule, { params: { ruleId }, body, options }),
    listCases: (query?: z.input<typeof riskCaseQuerySchema>, options?: RequestOptions) =>
      call(riskEndpoints.listCases, { query, options }),
    getCase: (caseId: string, options?: RequestOptions) =>
      call(riskEndpoints.getCase, { params: { caseId }, options }),
    assignCase: (caseId: string, options?: RequestOptions) =>
      call(riskEndpoints.assignCase, { params: { caseId }, options }),
    resolveCase: (
      caseId: string,
      body: z.input<typeof resolveRiskCaseRequestSchema>,
      options?: RequestOptions,
    ) => call(riskEndpoints.resolveCase, { params: { caseId }, body, options }),
  };
}

export type RiskApi = ReturnType<typeof createRiskApi>;
