import type {
  ClientSession,
  HydratedDocument,
  Model,
  QueryFilter,
  QueryOptions,
} from 'mongoose';

import { ConflictError, NotFoundError } from '../../common/errors/index.js';
import {
  DEFAULT_PAGE_SIZE,
  FIRST_PAGE,
  MAX_PAGE_SIZE,
} from './database.constants.js';

/**
 * Documents handled by BaseRepository carry a ULID `_id` and a numeric `version` that the
 * repository increments on every guarded write. Schemas opt in by declaring both props.
 */
export interface VersionedDoc {
  _id: string;
  version: number;
}

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
  readonly page: number;
  readonly pageSize: number;
}

export interface PaginateOptions<TDoc> {
  readonly filter?: QueryFilter<TDoc>;
  readonly sort?: Record<string, 1 | -1>;
  readonly page?: number;
  readonly pageSize?: number;
  readonly session?: ClientSession;
}

export interface UpdateWithVersionOptions<TDoc> {
  readonly id: string;
  readonly expectedVersion: number;
  /** Replacement field values; applied as `$set` alongside the version increment. */
  readonly update: Partial<TDoc>;
  readonly session?: ClientSession;
}

/**
 * Generic repository base.
 *
 * Exists because three mistakes kept recurring in hand-rolled repositories: sessions dropped
 * between the read and the write of one transaction, unbounded page sizes, and lost updates
 * when two requests write the same document concurrently. `updateWithVersion` closes the last
 * one by making the expected version part of the write filter — a stale writer matches no
 * document and gets a ConflictError instead of silently overwriting the fresher one.
 */
export abstract class BaseRepository<TDoc extends VersionedDoc> {
  protected constructor(
    protected readonly model: Model<TDoc>,
    private readonly resourceName: string,
  ) {}

  async findById(id: string, session?: ClientSession): Promise<HydratedDocument<TDoc> | null> {
    const query = this.model.findById(id);
    if (session !== undefined) {
      query.session(session);
    }
    return query.exec();
  }

  async paginate(options: PaginateOptions<TDoc> = {}): Promise<Page<HydratedDocument<TDoc>>> {
    const page = Math.max(FIRST_PAGE, options.page ?? FIRST_PAGE);
    const pageSize = clampPageSize(options.pageSize);
    const filter: QueryFilter<TDoc> = options.filter ?? {};
    const itemsQuery = this.model
      .find(filter)
      .sort(options.sort ?? { _id: 1 })
      .skip((page - FIRST_PAGE) * pageSize)
      .limit(pageSize);
    const countQuery = this.model.countDocuments(filter);
    if (options.session !== undefined) {
      itemsQuery.session(options.session);
      countQuery.session(options.session);
    }
    const [items, total] = await Promise.all([itemsQuery.exec(), countQuery.exec()]);
    return { items, total, page, pageSize };
  }

  /**
   * Optimistic-locking write: the update only lands while the stored version still equals
   * `expectedVersion`, so a caller that read a stale snapshot loses loudly instead of silently.
   */
  async updateWithVersion(
    options: UpdateWithVersionOptions<TDoc>,
  ): Promise<HydratedDocument<TDoc>> {
    const queryOptions: QueryOptions = { new: true };
    if (options.session !== undefined) {
      queryOptions.session = options.session;
    }
    const updated = await this.model
      .findOneAndUpdate(
        { _id: options.id, version: options.expectedVersion } as QueryFilter<TDoc>,
        { $set: options.update, $inc: { version: 1 } },
        queryOptions,
      )
      .exec();
    if (updated !== null) {
      return updated;
    }
    return this.rejectStaleWrite(options.id, options.session);
  }

  private async rejectStaleWrite(id: string, session?: ClientSession): Promise<never> {
    const existing = await this.findById(id, session);
    if (existing === null) {
      throw new NotFoundError(this.resourceName, id);
    }
    throw new ConflictError(
      `${this.resourceName} was modified concurrently; reload it and retry`,
      { resource: this.resourceName, identifier: id },
    );
  }
}

function clampPageSize(requested: number | undefined): number {
  if (requested === undefined || requested < 1) {
    return DEFAULT_PAGE_SIZE;
  }
  return Math.min(requested, MAX_PAGE_SIZE);
}
