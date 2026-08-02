import type {
  CaseStatus,
  OffsetPage,
  RiskCase,
  resolveRiskCaseRequestSchema,
  riskCaseQuerySchema,
} from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { newId, newReference } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { severityFor } from '../domain/scoring.js';
import { toRiskCase } from '../infrastructure/risk.mapper.js';
import { RiskAssessmentDoc, RiskCaseDoc } from '../infrastructure/risk-case.schemas.js';

export type RiskCaseQuery = ReturnType<typeof riskCaseQuerySchema.parse>;
export type ResolveCaseRequest = ReturnType<typeof resolveRiskCaseRequestSchema.parse>;
type ResolutionAction = ResolveCaseRequest['action'];

/** Without an explicit filter the queue shows work still waiting on an analyst. */
const ACTIONABLE: readonly CaseStatus[] = ['open', 'investigating', 'escalated'];

/** Where a case lands once an analyst has acted on it. */
const STATUS_AFTER: Readonly<Record<ResolutionAction, CaseStatus>> = {
  released: 'closed',
  blocked: 'closed',
  customer_contacted: 'closed',
  escalated_to_aml: 'escalated',
  no_action: 'dismissed',
};

/**
 * The fraud queue.
 *
 * A case exists only where a human must decide — review or block. Allowed and challenged
 * assessments are still stored, but they do not land here: a queue that contains everything is a
 * log, and a log is not worked.
 */
@Injectable()
export class RiskCasesService {
  private readonly logger = new Logger(RiskCasesService.name);

  constructor(
    @InjectModel(RiskCaseDoc.name) private readonly cases: Model<RiskCaseDoc>,
    @InjectModel(RiskAssessmentDoc.name) private readonly assessments: Model<RiskAssessmentDoc>,
    private readonly clock: ClockService,
  ) {}

  async raise(assessment: RiskAssessmentDoc, customerName: string): Promise<RiskCase> {
    const now = this.clock.now();
    const [created] = await this.cases.create([
      {
        _id: newId(),
        reference: newReference('CASE'),
        customerId: assessment.customerId,
        customerName,
        assessmentId: assessment._id,
        severity: severityFor(
          assessment.decision as RiskCase['assessment']['decision'],
          assessment.score,
        ),
        status: 'open',
        decision: assessment.decision,
        amountMinorUnits: assessment.amountMinorUnits,
        currency: assessment.currency,
        assignedTo: null,
        resolution: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);

    if (!created) {
      throw new ConflictError('The risk case could not be raised');
    }
    this.logger.warn(
      { caseId: created._id, score: assessment.score, decision: assessment.decision },
      'Risk case raised',
    );
    return toRiskCase(created, assessment);
  }

  async list(query: RiskCaseQuery): Promise<OffsetPage<RiskCase>> {
    const filter = this.buildFilter(query);
    const skip = (query.page - 1) * query.limit;

    const [rows, total] = await Promise.all([
      this.cases.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
      this.cases.countDocuments(filter),
    ]);

    const assessments = await this.loadAssessments(rows.map((row) => row.assessmentId));
    const items = rows.flatMap((row) => {
      const assessment = assessments.get(row.assessmentId);
      return assessment ? [toRiskCase(row, assessment)] : [];
    });

    return { items, page: query.page, limit: query.limit, total, totalPages: Math.ceil(total / query.limit) };
  }

  private buildFilter(query: RiskCaseQuery): Record<string, unknown> {
    return {
      status: { $in: query.status ?? ACTIONABLE },
      ...(query.severity?.length ? { severity: { $in: query.severity } } : {}),
      ...(query.decision?.length ? { decision: { $in: query.decision } } : {}),
      ...(query.assignedTo ? { assignedTo: query.assignedTo } : {}),
    };
  }

  private async loadAssessments(ids: string[]): Promise<Map<string, RiskAssessmentDoc>> {
    const rows = await this.assessments.find({ _id: { $in: ids } }).lean();
    return new Map(rows.map((row) => [row._id, row]));
  }

  async byId(caseId: string): Promise<RiskCase> {
    const row = await this.requireCase(caseId);
    const assessment = await this.assessments.findById(row.assessmentId).lean();
    if (!assessment) {
      throw new NotFoundError('Risk assessment', row.assessmentId);
    }
    return toRiskCase(row, assessment);
  }

  private async requireCase(caseId: string): Promise<RiskCaseDoc> {
    const row = await this.cases.findById(caseId).lean();
    if (!row) {
      throw new NotFoundError('Risk case', caseId);
    }
    return row;
  }

  /** An analyst claims a case from the queue. The claimant is always the caller, never a body. */
  async claim(caseId: string, staffId: string): Promise<RiskCase> {
    const row = await this.requireCase(caseId);
    if (row.resolution) {
      throw new ConflictError('This case has already been resolved', { caseId });
    }
    await this.cases.updateOne(
      { _id: caseId },
      { $set: { assignedTo: staffId, status: 'investigating', updatedAt: this.clock.now() } },
    );
    return this.byId(caseId);
  }

  async resolve(
    caseId: string,
    staff: { id: string; label: string },
    request: ResolveCaseRequest,
  ): Promise<RiskCase> {
    const row = await this.requireCase(caseId);
    if (row.resolution) {
      throw new ConflictError('This case has already been resolved', { caseId });
    }

    const now = this.clock.now();
    await this.cases.updateOne(
      { _id: caseId },
      {
        $set: {
          status: STATUS_AFTER[request.action],
          assignedTo: row.assignedTo ?? staff.id,
          resolution: { action: request.action, note: request.note, by: staff.label, at: now },
          updatedAt: now,
        },
      },
    );

    this.logger.log({ caseId, action: request.action, by: staff.id }, 'Risk case resolved');
    return this.byId(caseId);
  }
}
