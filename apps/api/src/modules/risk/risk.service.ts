import type { FiredRule, RiskAssessment } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError } from '../../common/errors/index.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { buildNarrative } from './domain/narrative.js';
import { runRules } from './domain/rule-engine.js';
import type { RuleContext } from './domain/rules/rule.types.js';
import { decideFrom, needsCase, scoreOf } from './domain/scoring.js';
import { RiskCasesService } from './application/risk-cases.service.js';
import { RiskContextService, type ContextRequest, type RiskSignals } from './application/risk-context.service.js';
import { RiskRulesService } from './application/risk-rules.service.js';
import { toRiskAssessment } from './infrastructure/risk.mapper.js';
import { RiskAssessmentDoc } from './infrastructure/risk-case.schemas.js';

export interface AssessmentRequest {
  readonly subjectType: RiskAssessment['subjectType'];
  readonly subjectId: string;
  readonly customerId: string;
  readonly amountMinorUnits: number;
  readonly currency: CurrencyCode;
  readonly signals?: RiskSignals;
}

/**
 * The fraud engine.
 *
 * One entry point, one order of operations, every time: build the context, run the enabled rules,
 * score, decide, explain, store, and escalate if a human is needed. Nothing short-circuits — even
 * an allowed payment is assessed and stored, because a rule nobody measures on good traffic is a
 * rule nobody dares tune.
 *
 * The explanation is produced here rather than at the call site so that it can never disagree
 * with the score: both come from the same fired rules.
 */
@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  constructor(
    private readonly rules: RiskRulesService,
    private readonly contexts: RiskContextService,
    private readonly cases: RiskCasesService,
    @InjectModel(RiskAssessmentDoc.name) private readonly assessments: Model<RiskAssessmentDoc>,
    private readonly clock: ClockService,
  ) {}

  async assess(request: AssessmentRequest): Promise<RiskAssessment> {
    const contextRequest: ContextRequest = {
      customerId: request.customerId,
      amountMinorUnits: request.amountMinorUnits,
      currency: request.currency,
      signals: request.signals ?? {},
    };

    const { context, customerName } = await this.contexts.build(contextRequest);
    const activeRules = await this.rules.activeRules();
    const firedRules = runRules(activeRules, context);

    const stored = await this.record(request, context, firedRules, activeRules.length);

    if (needsCase(stored.decision as RiskAssessment['decision'])) {
      await this.cases.raise(stored, customerName);
    }
    // Folded in last, so the device that tripped a rule was still unknown while it ran.
    await this.contexts.observe(contextRequest);

    return toRiskAssessment(stored);
  }

  /** Score, decide, explain and persist — the immutable record of one decision. */
  private async record(
    request: AssessmentRequest,
    context: RuleContext,
    firedRules: FiredRule[],
    rulesConsidered: number,
  ): Promise<RiskAssessmentDoc> {
    const score = scoreOf(firedRules);
    const decision = decideFrom(score, await this.rules.thresholds());

    const [created] = await this.assessments.create([
      {
        _id: newId(),
        subjectType: request.subjectType,
        subjectId: request.subjectId,
        customerId: request.customerId,
        score,
        decision,
        firedRules,
        narrative: this.explain(request, firedRules, { score, decision, rulesConsidered }),
        amountMinorUnits: request.amountMinorUnits,
        currency: request.currency,
        rulesConsidered,
        assessedAt: context.at,
      },
    ]);

    if (!created) {
      throw new ConflictError('The risk assessment could not be recorded');
    }
    this.logger.debug({ score, decision, fired: firedRules.length }, 'Assessed');
    return created;
  }

  private explain(
    request: AssessmentRequest,
    firedRules: FiredRule[],
    verdict: { score: number; decision: RiskAssessment['decision']; rulesConsidered: number },
  ): string {
    return buildNarrative({
      subjectType: request.subjectType,
      subjectId: request.subjectId,
      amountMinorUnits: request.amountMinorUnits,
      currency: request.currency,
      firedRules,
      ...verdict,
    });
  }

  /** The stored assessments for a subject, newest first — the audit view of one payment. */
  async assessmentsFor(subjectType: string, subjectId: string): Promise<RiskAssessment[]> {
    const rows = await this.assessments
      .find({ subjectType, subjectId })
      .sort({ assessedAt: -1 })
      .lean();
    return rows.map(toRiskAssessment);
  }
}
