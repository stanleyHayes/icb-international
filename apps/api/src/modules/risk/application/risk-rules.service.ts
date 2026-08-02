import type { RiskRule, updateRiskRuleRequestSchema } from '@icb/contracts';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../../common/errors/index.js';
import { newId } from '../../../infrastructure/database/identifier.js';
import { DEFAULT_RULES, type RuleSeed } from '../domain/default-rules.js';
import {
  DEFAULT_DECISION_THRESHOLDS,
  normaliseThresholds,
  type DecisionThresholds,
} from '../domain/scoring.js';
import { toRiskRule } from '../infrastructure/risk.mapper.js';
import {
  DECISION_THRESHOLD_KEY,
  RiskRuleDoc,
  RiskSettingsDoc,
} from '../infrastructure/risk-rule.schemas.js';

export type UpdateRuleRequest = ReturnType<typeof updateRiskRuleRequestSchema.parse>;

/**
 * Rule configuration.
 *
 * Seeding is idempotent *and* non-destructive: the label, description and kind of a rule are code
 * and are refreshed on every boot, while its weight, parameters and enabled flag belong to the
 * fraud team and are written only on first insert. A deploy must never silently undo a threshold
 * that was tightened during an incident.
 */
@Injectable()
export class RiskRulesService implements OnModuleInit {
  private readonly logger = new Logger(RiskRulesService.name);

  constructor(
    @InjectModel(RiskRuleDoc.name) private readonly rules: Model<RiskRuleDoc>,
    @InjectModel(RiskSettingsDoc.name) private readonly settings: Model<RiskSettingsDoc>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedDefaults();
  }

  async seedDefaults(): Promise<void> {
    for (const seed of DEFAULT_RULES) {
      await this.rules.updateOne(
        { code: seed.code },
        { $set: this.codeOwnedFields(seed), $setOnInsert: this.teamOwnedFields(seed) },
        { upsert: true },
      );
    }
    await this.seedThresholds();
    this.logger.log({ rules: DEFAULT_RULES.length }, 'Risk rule set seeded');
  }

  /** Owned by the codebase: refreshed on every boot. */
  private codeOwnedFields(seed: RuleSeed): Partial<RiskRuleDoc> {
    return { label: seed.label, description: seed.description, kind: seed.kind };
  }

  /** Owned by the fraud team: written once, then never touched by a deploy again. */
  private teamOwnedFields(seed: RuleSeed): Partial<RiskRuleDoc> {
    return {
      _id: newId(),
      code: seed.code,
      enabled: true,
      weight: seed.weight,
      parameters: seed.parameters,
      updatedBy: null,
      lastChangeReason: null,
    };
  }

  private async seedThresholds(): Promise<void> {
    await this.settings.updateOne(
      { key: DECISION_THRESHOLD_KEY },
      {
        $setOnInsert: {
          _id: newId(),
          key: DECISION_THRESHOLD_KEY,
          challengeAt: DEFAULT_DECISION_THRESHOLDS.challenge,
          reviewAt: DEFAULT_DECISION_THRESHOLDS.review,
          blockAt: DEFAULT_DECISION_THRESHOLDS.block,
          updatedBy: null,
        },
      },
      { upsert: true },
    );
  }

  /** The configured decision bands, falling back to the shipped defaults if the row is missing. */
  async thresholds(): Promise<DecisionThresholds> {
    const row = await this.settings.findOne({ key: DECISION_THRESHOLD_KEY }).lean();
    if (!row) {
      return DEFAULT_DECISION_THRESHOLDS;
    }
    return normaliseThresholds({
      challenge: row.challengeAt,
      review: row.reviewAt,
      block: row.blockAt,
    });
  }

  async list(): Promise<RiskRule[]> {
    const rows = await this.rules.find().sort({ code: 1 }).lean();
    return rows.map(toRiskRule);
  }

  /** The rules the engine will actually run. Disabled rules never reach an evaluator. */
  async activeRules(): Promise<RiskRule[]> {
    const rows = await this.rules.find({ enabled: true }).sort({ code: 1 }).lean();
    return rows.map(toRiskRule);
  }

  async update(ruleId: string, staffId: string, request: UpdateRuleRequest): Promise<RiskRule> {
    const update: Partial<RiskRuleDoc> = {
      updatedBy: staffId,
      lastChangeReason: request.reason,
      ...(request.enabled === undefined ? {} : { enabled: request.enabled }),
      ...(request.weight === undefined ? {} : { weight: request.weight }),
      ...(request.parameters === undefined ? {} : { parameters: request.parameters }),
    };

    const updated = await this.rules
      .findOneAndUpdate({ _id: ruleId }, { $set: update }, { new: true })
      .lean();

    if (!updated) {
      throw new NotFoundError('Risk rule', ruleId);
    }
    this.logger.log({ ruleId, staffId, reason: request.reason }, 'Risk rule changed');
    return toRiskRule(updated);
  }
}
