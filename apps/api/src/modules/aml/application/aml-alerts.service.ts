import type {
  AmlAlert,
  OffsetPage,
  amlAlertQuerySchema,
  updateAmlAlertRequestSchema,
} from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../../common/errors/index.js';
import { newId, newReference } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { ACTIONABLE_STATUSES, assertTransition } from '../domain/case-workflow.js';
import { buildAlertNarrative } from '../domain/narrative.js';
import type { ScenarioHit } from '../domain/scenario.types.js';
import { severityFor } from '../domain/severity.js';
import { AmlAlertDoc } from '../infrastructure/aml-alert.schemas.js';
import { toAmlAlert } from '../infrastructure/aml.mapper.js';

export type AmlAlertQuery = ReturnType<typeof amlAlertQuerySchema.parse>;
export type UpdateAmlAlertRequest = ReturnType<typeof updateAmlAlertRequestSchema.parse>;

export interface RaiseAlertInput {
  readonly customerId: string;
  readonly customerName: string;
  readonly hit: ScenarioHit;
}

export interface StaffActor {
  readonly id: string;
  readonly label: string;
}

interface TrailEntry {
  readonly at: Date;
  readonly by: string;
  readonly action: string;
  readonly detail: string;
}

/**
 * The AML alert queue.
 *
 * One open alert per customer per kind: a second detection of the same pattern against the same
 * customer updates nothing and creates nothing — ten identical rows do not make the pattern ten
 * times as suspicious, they make the queue ten rows noisier. The alert already on the board keeps
 * its original evidence.
 */
@Injectable()
export class AmlAlertsService {
  private readonly logger = new Logger(AmlAlertsService.name);

  constructor(
    @InjectModel(AmlAlertDoc.name) private readonly alerts: Model<AmlAlertDoc>,
    private readonly clock: ClockService,
  ) {}

  /** Raise an alert for a hit, or return null when one is already being worked. */
  async raise(input: RaiseAlertInput): Promise<AmlAlert | null> {
    const existing = await this.alerts
      .findOne({
        customerId: input.customerId,
        kind: input.hit.kind,
        status: { $in: ACTIONABLE_STATUSES },
      })
      .lean();
    if (existing) {
      return null;
    }

    const severity = severityFor(input.hit);
    const [created] = await this.alerts.create([this.newAlertDocument(input, severity)]);

    if (!created) {
      throw new NotFoundError('AML alert', input.customerId);
    }
    this.logger.warn({ alertId: created._id, kind: created.kind, severity }, 'AML alert raised');
    return toAmlAlert(created);
  }

  private newAlertDocument(input: RaiseAlertInput, severity: AmlAlert['severity']) {
    const now = this.clock.now();
    return {
      _id: newId(),
      reference: newReference('AML'),
      kind: input.hit.kind,
      customerId: input.customerId,
      customerName: input.customerName,
      severity,
      status: 'open',
      matchDetail: input.hit.matchDetail,
      matchScore: input.hit.matchScore,
      relatedTransactionIds: [...input.hit.relatedTransactionIds],
      aggregateMinorUnits: input.hit.aggregateMinorUnits,
      currency: input.hit.currency,
      narrative: buildAlertNarrative({ customerName: input.customerName, severity, hit: input.hit }),
      assignedTo: null,
      filedReport: null,
      trail: [this.entry('system', 'raised', `Alert raised: ${input.hit.kind}`, now)],
      createdAt: now,
      updatedAt: now,
    };
  }

  async list(query: AmlAlertQuery): Promise<OffsetPage<AmlAlert>> {
    const filter: Record<string, unknown> = {
      status: { $in: query.status ?? ACTIONABLE_STATUSES },
      ...(query.kind?.length ? { kind: { $in: query.kind } } : {}),
      ...(query.severity?.length ? { severity: { $in: query.severity } } : {}),
    };
    const skip = (query.page - 1) * query.limit;

    const [rows, total] = await Promise.all([
      this.alerts.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
      this.alerts.countDocuments(filter),
    ]);

    return {
      items: rows.map((row) => toAmlAlert(row)),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async byId(alertId: string): Promise<AmlAlert> {
    return toAmlAlert(await this.require(alertId));
  }

  async require(alertId: string): Promise<AmlAlertDoc> {
    const row = await this.alerts.findById(alertId).lean();
    if (!row) {
      throw new NotFoundError('AML alert', alertId);
    }
    return row;
  }

  /** Assignment, status moves and narrative edits — every one lands in the trail. */
  async update(alertId: string, staff: StaffActor, request: UpdateAmlAlertRequest): Promise<AmlAlert> {
    const row = await this.require(alertId);
    const trail: TrailEntry[] = [];
    const set: Record<string, unknown> = { updatedAt: this.clock.now() };

    if (request.status !== undefined && request.status !== row.status) {
      assertTransition(row.status as AmlAlert['status'], request.status);
      set['status'] = request.status;
      trail.push(this.entry(staff.label, 'status', `${row.status} → ${request.status}`));
    }
    if (request.assignedTo !== undefined && request.assignedTo !== row.assignedTo) {
      set['assignedTo'] = request.assignedTo;
      const detail = request.assignedTo === null ? 'unassigned' : `assigned to ${request.assignedTo}`;
      trail.push(this.entry(staff.label, 'assign', detail));
    }
    if (request.narrative !== undefined) {
      set['narrative'] = request.narrative;
      trail.push(this.entry(staff.label, 'note', 'narrative updated'));
    }

    await this.alerts.updateOne(
      { _id: alertId },
      { $set: set, ...(trail.length > 0 ? { $push: { trail: { $each: trail } } } : {}) },
    );
    return this.byId(alertId);
  }

  entry(by: string, action: string, detail: string, at?: Date): TrailEntry {
    return { at: at ?? this.clock.now(), by, action, detail };
  }
}
