import {
  resolveRiskCaseRequestSchema,
  riskCaseQuerySchema,
  updateRiskRuleRequestSchema,
  type OffsetPage,
  type RiskCase,
  type RiskRule,
} from '@icb/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { ZodValidationPipe, zodBody } from '../../common/pipes/zod-validation.pipe.js';
import type { AccessTokenClaims } from '../auth/application/token.service.js';
import {
  RiskCasesService,
  type ResolveCaseRequest,
  type RiskCaseQuery,
} from './application/risk-cases.service.js';
import { RiskRulesService, type UpdateRuleRequest } from './application/risk-rules.service.js';
import { FRAUD_ROLES } from './risk.roles.js';

/**
 * The fraud back office.
 *
 * Two surfaces that belong together: the queue of payments a human must decide on, and the rule
 * configuration that put them there. An analyst who tunes a weight and immediately sees what it
 * does to the queue is the difference between a tuned model and a guessed one.
 *
 * The acting staff member is always taken from the verified token — never from a body — so a
 * resolution cannot be attributed to somebody else.
 */
@Controller('risk')
@UseGuards(RolesGuard)
@Roles(...FRAUD_ROLES)
export class RiskController {
  constructor(
    private readonly cases: RiskCasesService,
    private readonly ruleConfig: RiskRulesService,
  ) {}

  @Get('cases')
  async listCases(
    @Query(new ZodValidationPipe(riskCaseQuerySchema)) query: RiskCaseQuery,
  ): Promise<OffsetPage<RiskCase>> {
    return this.cases.list(query);
  }

  @Get('cases/:caseId')
  async caseDetail(@Param('caseId') caseId: string): Promise<RiskCase> {
    return this.cases.byId(caseId);
  }

  /** Claim a case from the queue. The claimant is the caller, so it cannot be spoofed. */
  @Post('cases/:caseId/assign')
  @HttpCode(HttpStatus.OK)
  async claimCase(
    @CurrentUser() staff: AccessTokenClaims,
    @Param('caseId') caseId: string,
  ): Promise<RiskCase> {
    return this.cases.claim(caseId, staff.sub);
  }

  @Post('cases/:caseId/resolve')
  @HttpCode(HttpStatus.OK)
  async resolveCase(
    @CurrentUser() staff: AccessTokenClaims,
    @Param('caseId') caseId: string,
    @Body(zodBody(resolveRiskCaseRequestSchema)) body: ResolveCaseRequest,
  ): Promise<RiskCase> {
    return this.cases.resolve(caseId, { id: staff.sub, label: staff.email }, body);
  }

  @Get('rules')
  async listRules(): Promise<{ items: RiskRule[] }> {
    return { items: await this.ruleConfig.list() };
  }

  /** Enable, disable, re-weight or re-parameterise a rule. A reason is mandatory. */
  @Patch('rules/:ruleId')
  async updateRule(
    @CurrentUser() staff: AccessTokenClaims,
    @Param('ruleId') ruleId: string,
    @Body(zodBody(updateRiskRuleRequestSchema)) body: UpdateRuleRequest,
  ): Promise<RiskRule> {
    return this.ruleConfig.update(ruleId, staff.sub, body);
  }
}
