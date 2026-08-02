import { z } from 'zod';
import {
  offsetPageSchema,
  resolveRiskCaseRequestSchema,
  riskAssessmentSchema,
  riskCaseQuerySchema,
  riskCaseSchema,
  riskRuleSchema,
  updateRiskRuleRequestSchema,
} from '@icb/contracts';

import { get, patch, post, type Requester } from '../endpoint.js';
import { type RequestOptions } from '../http.js';

export const riskEndpoints = {
  listRules: get('/admin/risk/rules', z.array(riskRuleSchema)),
  updateRule: patch('/admin/risk/rules/:ruleId', riskRuleSchema, {
    body: updateRiskRuleRequestSchema,
  }),
  listCases: get('/admin/risk/cases', offsetPageSchema(riskCaseSchema)),
  getCase: get('/admin/risk/cases/:caseId', riskCaseSchema),
  resolveCase: post('/admin/risk/cases/:caseId/resolution', riskCaseSchema, {
    body: resolveRiskCaseRequestSchema,
  }),
  getAssessment: get('/admin/risk/assessments/:assessmentId', riskAssessmentSchema),
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
    resolveCase: (
      caseId: string,
      body: z.input<typeof resolveRiskCaseRequestSchema>,
      options?: RequestOptions,
    ) => call(riskEndpoints.resolveCase, { params: { caseId }, body, options }),
    getAssessment: (assessmentId: string, options?: RequestOptions) =>
      call(riskEndpoints.getAssessment, { params: { assessmentId }, options }),
  };
}

export type RiskApi = ReturnType<typeof createRiskApi>;
