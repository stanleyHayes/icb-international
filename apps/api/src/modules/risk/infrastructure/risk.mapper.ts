import type {
  AlertSeverity,
  CaseStatus,
  RiskAssessment,
  RiskCase,
  RiskDecision,
  RiskRule,
} from '@icb/contracts';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import type { RiskAssessmentDoc, RiskCaseDoc } from './risk-case.schemas.js';
import type { RiskRuleDoc } from './risk-rule.schemas.js';

/**
 * Persistence → contract.
 *
 * The documents store enums as plain strings so that a vocabulary added to the contract does not
 * require a migration; narrowing happens here, at the one boundary where the shape is checked.
 */

export function toRiskRule(rule: RiskRuleDoc): RiskRule {
  return {
    id: rule._id,
    code: rule.code,
    label: rule.label,
    description: rule.description,
    kind: rule.kind as RiskRule['kind'],
    enabled: rule.enabled,
    weight: rule.weight,
    parameters: rule.parameters,
    updatedBy: rule.updatedBy,
    updatedAt: rule.updatedAt.toISOString(),
  };
}

export function toRiskAssessment(assessment: RiskAssessmentDoc): RiskAssessment {
  return {
    id: assessment._id,
    subjectType: assessment.subjectType as RiskAssessment['subjectType'],
    subjectId: assessment.subjectId,
    score: assessment.score,
    decision: assessment.decision as RiskDecision,
    firedRules: assessment.firedRules,
    narrative: assessment.narrative,
    assessedAt: assessment.assessedAt.toISOString(),
  };
}

export function toRiskCase(riskCase: RiskCaseDoc, assessment: RiskAssessmentDoc): RiskCase {
  return {
    id: riskCase._id,
    reference: riskCase.reference,
    customerId: riskCase.customerId,
    customerName: riskCase.customerName,
    severity: riskCase.severity as AlertSeverity,
    status: riskCase.status as CaseStatus,
    assessment: toRiskAssessment(assessment),
    amountAtRisk:
      riskCase.amountMinorUnits === null || riskCase.currency === null
        ? null
        : toMoneyDto(riskCase.amountMinorUnits, riskCase.currency),
    assignedTo: riskCase.assignedTo,
    resolution: riskCase.resolution
      ? {
          action: riskCase.resolution.action as NonNullable<RiskCase['resolution']>['action'],
          note: riskCase.resolution.note,
          by: riskCase.resolution.by,
          at: riskCase.resolution.at.toISOString(),
        }
      : null,
    createdAt: riskCase.createdAt.toISOString(),
  };
}
