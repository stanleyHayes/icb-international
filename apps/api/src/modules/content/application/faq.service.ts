import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { FaqArticleView, FaqCreateRequest, FaqUpdateRequest } from '@icb/contracts';
import { slugify } from '@icb/media';
import type { Model } from 'mongoose';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { isDuplicateKeyError } from '../../../infrastructure/database/mongo-errors.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import { toFaqArticleView } from '../infrastructure/content.mapper.js';
import { ContentArticleDoc } from '../infrastructure/content.schemas.js';

/**
 * FAQ / help-centre articles.
 *
 * The staff surface sees every article; the public surface sees only published ones, in the
 * order the editors arranged. Slugs are the public identity, so a collision is a conflict,
 * not a silent overwrite.
 */
@Injectable()
export class FaqService {
  constructor(
    @InjectModel(ContentArticleDoc.name) private readonly articles: Model<ContentArticleDoc>,
    private readonly clock: ClockService,
  ) {}

  /** Staff list: everything, in display order. */
  async listAll(): Promise<FaqArticleView[]> {
    const rows = await this.articles.find().sort({ category: 1, ordering: 1, title: 1 }).lean();
    return rows.map(toFaqArticleView);
  }

  /** Public list: published only, optionally one category. */
  async listPublished(category?: string): Promise<FaqArticleView[]> {
    const filter: Record<string, unknown> = { published: true };
    if (category !== undefined) {
      filter['category'] = category;
    }
    const rows = await this.articles.find(filter).sort({ ordering: 1, title: 1 }).lean();
    return rows.map(toFaqArticleView);
  }

  async create(staff: AccessTokenClaims, request: FaqCreateRequest): Promise<FaqArticleView> {
    const now = this.clock.now();
    const slug = request.slug ?? slugify(request.title);
    try {
      const [article] = await this.articles.create([
        { ...request, slug, createdBy: staff.sub, createdAt: now, updatedAt: now },
      ]);
      return toFaqArticleView(article as ContentArticleDoc);
    } catch (error) {
      throw this.asConflict(error, slug);
    }
  }

  async update(articleId: string, request: FaqUpdateRequest): Promise<FaqArticleView> {
    const set: Record<string, unknown> = { ...request, updatedAt: this.clock.now() };
    try {
      const updated = await this.articles
        .findOneAndUpdate({ _id: articleId }, { $set: set }, { new: true })
        .lean();
      if (!updated) {
        throw new NotFoundError('Article', articleId);
      }
      return toFaqArticleView(updated);
    } catch (error) {
      throw this.asConflict(error, request.slug ?? '');
    }
  }

  async remove(articleId: string): Promise<void> {
    const result = await this.articles.deleteOne({ _id: articleId });
    if (result.deletedCount === 0) {
      throw new NotFoundError('Article', articleId);
    }
  }

  private asConflict(error: unknown, slug: string): unknown {
    if (isDuplicateKeyError(error)) {
      return new ConflictError('An article with this slug already exists', { slug });
    }
    return error;
  }
}
