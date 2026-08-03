import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model, QueryFilter } from 'mongoose';

import { offsetOf } from '../../../common/pagination/offset.js';
import { WALK_BATCH_SIZE } from '../audit.constants.js';
import type { AuditQuery } from '../domain/audit-event.js';
import { AuditEventDoc } from './audit-event.schemas.js';

export interface AuditEventPage {
  readonly items: AuditEventDoc[];
  readonly total: number;
}

function buildFilter(query: AuditQuery): QueryFilter<AuditEventDoc> {
  const filter: QueryFilter<AuditEventDoc> = {};
  if (query.actorId !== undefined) {
    filter.actorId = query.actorId;
  }
  if (query.action !== undefined) {
    filter.action = query.action;
  }
  if (query.subjectType !== undefined) {
    filter.subjectType = query.subjectType;
  }
  if (query.subjectId !== undefined) {
    filter.subjectId = query.subjectId;
  }
  if (query.from !== undefined || query.to !== undefined) {
    filter.at = {
      ...(query.from !== undefined ? { $gte: new Date(query.from) } : {}),
      ...(query.to !== undefined ? { $lte: new Date(query.to) } : {}),
    };
  }
  return filter;
}

/**
 * Persistence for the audit chain. This class is the port boundary — services are unit-tested
 * against a fake of it, and no other code may touch the `audit_events` collection.
 *
 * It deliberately exposes no update or delete: the schema rejects those operations, and the
 * repository does not even offer them.
 */
@Injectable()
export class AuditEventRepository {
  constructor(
    @InjectModel(AuditEventDoc.name) private readonly model: Model<AuditEventDoc>,
  ) {}

  /** The current chain head — the row every new event links from. */
  async last(): Promise<AuditEventDoc | null> {
    return this.model.findOne().sort({ sequence: -1 }).exec();
  }

  async insert(event: AuditEventDoc): Promise<void> {
    await this.model.create([event]);
  }

  /** Offset page for the admin console, newest first. */
  async page(query: AuditQuery): Promise<AuditEventPage> {
    const filter = buildFilter(query);
    const [items, total] = await Promise.all([
      this.model
        .find(filter)
        .sort({ sequence: -1 })
        .skip(offsetOf(query))
        .limit(query.limit)
        .exec(),
      this.model.countDocuments(filter).exec(),
    ]);
    return { items, total };
  }

  /** Every event in chain order, batched — the tamper-verification walk. */
  walkAll(): AsyncGenerator<AuditEventDoc> {
    return this.walk({});
  }

  /** Every event matching a search, in chain order, batched — the export stream. */
  walkQuery(query: AuditQuery): AsyncGenerator<AuditEventDoc> {
    return this.walk(buildFilter(query));
  }

  private async *walk(filter: QueryFilter<AuditEventDoc>): AsyncGenerator<AuditEventDoc> {
    let afterSequence = -1;
    let batch: AuditEventDoc[];
    do {
      batch = await this.model
        .find({ ...filter, sequence: { $gt: afterSequence } })
        .sort({ sequence: 1 })
        .limit(WALK_BATCH_SIZE)
        .exec();
      for (const doc of batch) {
        afterSequence = doc.sequence;
        yield doc;
      }
    } while (batch.length === WALK_BATCH_SIZE);
  }
}
