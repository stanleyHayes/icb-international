import { slugify } from '@icb/media';
import type { Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import { FaqService } from '../application/faq.service.js';
import type { ContentArticleDoc } from '../infrastructure/content.schemas.js';

const NOW = new Date('2026-08-02T12:00:00.000Z');
const STAFF = { sub: 'staff-1' } as AccessTokenClaims;

function articleDoc(overrides: Partial<ContentArticleDoc> = {}): ContentArticleDoc {
  return {
    _id: 'art-1',
    title: 'How do I freeze my card?',
    slug: 'how-do-i-freeze-my-card',
    category: 'cards',
    body: 'Open the app, tap Cards, tap Freeze.',
    published: true,
    ordering: 10,
    createdBy: 'staff-1',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function setup() {
  const articles = {
    find: vi.fn(() => ({
      sort: vi.fn(() => ({ lean: vi.fn().mockResolvedValue([articleDoc()]) })),
    })),
    findOneAndUpdate: vi.fn(() => ({ lean: vi.fn().mockResolvedValue(articleDoc()) })),
    create: vi.fn((docs: unknown[]) => Promise.resolve(docs)),
    deleteOne: vi.fn().mockResolvedValue({ deletedCount: 1 }),
  };
  const clock = new ClockService();
  clock.freeze(NOW);
  const service = new FaqService(articles as unknown as Model<ContentArticleDoc>, clock);
  return { service, articles };
}

describe('slugify', () => {
  it('derives a URL-safe slug from a title', () => {
    expect(slugify('How do I freeze my card?')).toBe('how-do-i-freeze-my-card');
  });

  it('collapses punctuation runs and trims dashes', () => {
    expect(slugify('  ATMs & Branches — Accra! ')).toBe('atms-branches-accra');
  });
});

describe('FaqService', () => {
  it('lists every article for staff in display order', async () => {
    const { service, articles } = setup();
    const views = await service.listAll();
    expect(articles.find).toHaveBeenCalledWith();
    expect(views[0]?.id).toBe('art-1');
    expect(views[0]?.createdAt).toBe(NOW.toISOString());
  });

  it('lists only published articles publicly, filtered by category when given', async () => {
    const { service, articles } = setup();
    await service.listPublished('cards');
    expect(articles.find).toHaveBeenCalledWith({ published: true, category: 'cards' });
  });

  it('creates an article, deriving the slug from the title', async () => {
    const { service, articles } = setup();
    const view = await service.create(STAFF, {
      title: 'How do I freeze my card?',
      category: 'cards',
      body: 'Open the app, tap Cards, tap Freeze.',
      published: true,
      ordering: 10,
    });
    const written = articles.create.mock.calls[0]?.[0] as Record<string, unknown>[];
    expect(written[0]?.['slug']).toBe('how-do-i-freeze-my-card');
    expect(written[0]?.['createdBy']).toBe('staff-1');
    expect(view.slug).toBe('how-do-i-freeze-my-card');
  });

  it('maps a duplicate slug to a conflict', async () => {
    const { service, articles } = setup();
    articles.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));
    await expect(
      service.create(STAFF, {
        title: 'Freeze card',
        slug: 'how-do-i-freeze-my-card',
        category: 'cards',
        body: 'Body',
        published: false,
        ordering: 100,
      }),
    ).rejects.toBeInstanceOf(ConflictError);
  });

  it('throws NotFoundError when updating a missing article', async () => {
    const { service, articles } = setup();
    articles.findOneAndUpdate.mockReturnValue({ lean: vi.fn().mockResolvedValue(null) });
    await expect(service.update('missing', { title: 'New title' })).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('throws NotFoundError when deleting a missing article', async () => {
    const { service, articles } = setup();
    articles.deleteOne.mockResolvedValue({ deletedCount: 0 });
    await expect(service.remove('missing')).rejects.toBeInstanceOf(NotFoundError);
  });
});
