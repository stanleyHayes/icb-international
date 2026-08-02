import type { KycCase, KycQueueQuery, KycStatus, OffsetPage } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, QueryFilter } from 'mongoose';

import { NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { toKycCase } from '../infrastructure/kyc.mapper.js';
import { KycCaseDoc } from '../infrastructure/kyc.schemas.js';

/**
 * The compliance review queue.
 *
 * Ordered by SLA deadline ascending, which puts the most overdue case at the top and the case
 * about to breach immediately below it. That is the whole point of an SLA timer: the team is
 * measured on it, so the queue must show work in the order it will be judged, not in the order
 * it happened to arrive.
 */

/** Without an explicit filter the queue shows work that is waiting on the bank, not the customer. */
const ACTIONABLE: readonly KycStatus[] = ['pending_review', 'more_info_required'];

interface QueueFilter {
  status: { $in: readonly KycStatus[] };
  requestedLevel?: string;
  riskRating?: string;
  assignedTo?: string;
  slaDueAt?: { $lt: Date };
}

@Injectable()
export class KycQueueService {
  constructor(
    @InjectModel(KycCaseDoc.name) private readonly cases: Model<KycCaseDoc>,
    private readonly clock: ClockService,
  ) {}

  async list(query: KycQueueQuery): Promise<OffsetPage<KycCase>> {
    const filter = this.buildFilter(query) as QueryFilter<KycCaseDoc>;
    const skip = (query.page - 1) * query.limit;

    const [rows, total] = await Promise.all([
      this.cases
        .find(filter)
        .sort({ slaDueAt: 1, createdAt: 1 })
        .skip(skip)
        .limit(query.limit)
        .lean(),
      this.cases.countDocuments(filter),
    ]);

    return {
      items: rows.map(toKycCase),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  /** A single case for the reviewer's detail pane. Staff read any case; ownership does not apply. */
  async byId(caseId: string): Promise<KycCaseDoc> {
    const row = await this.cases.findById(caseId).lean();
    if (!row) {
      throw new NotFoundError('KYC case', caseId);
    }
    return row;
  }

  private buildFilter(query: KycQueueQuery): QueueFilter {
    return {
      status: { $in: query.status ?? ACTIONABLE },
      ...(query.level ? { requestedLevel: query.level } : {}),
      ...(query.riskRating ? { riskRating: query.riskRating } : {}),
      ...(query.assignedTo ? { assignedTo: query.assignedTo } : {}),
      ...(query.overdueOnly ? { slaDueAt: { $lt: this.clock.now() } } : {}),
    };
  }
}
