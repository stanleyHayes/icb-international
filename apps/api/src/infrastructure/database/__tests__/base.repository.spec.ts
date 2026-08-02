import type { ClientSession, Model } from 'mongoose';
import { describe, expect, it, vi } from 'vitest';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import {
  BaseRepository,
  type VersionedDoc,
} from '../base.repository.js';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../database.constants.js';

interface WidgetDoc extends VersionedDoc {
  name: string;
}

class WidgetRepository extends BaseRepository<WidgetDoc> {
  constructor(model: Model<WidgetDoc>) {
    super(model, 'Widget');
  }
}

/** Minimal chainable stand-in for a Mongoose Query. */
function queryOf<T>(result: T) {
  return {
    session: vi.fn().mockReturnThis(),
    sort: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(result),
  };
}

function modelMock() {
  return {
    findById: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    findOneAndUpdate: vi.fn(),
  };
}

function setup() {
  const model = modelMock();
  const repository = new WidgetRepository(model as unknown as Model<WidgetDoc>);
  return { model, repository };
}

const widget = { _id: '01JABC', version: 3, name: 'widget' };
const session = { id: 'session-1' } as unknown as ClientSession;

describe('findById', () => {
  it('returns the document when found and null when not', async () => {
    const { model, repository } = setup();
    model.findById.mockReturnValueOnce(queryOf(widget)).mockReturnValueOnce(queryOf(null));

    await expect(repository.findById(widget._id)).resolves.toBe(widget);
    await expect(repository.findById('missing')).resolves.toBeNull();
    expect(model.findById).toHaveBeenNthCalledWith(2, 'missing');
  });

  it('threads the session into the query when one is given', async () => {
    const { model, repository } = setup();
    const query = queryOf(widget);
    model.findById.mockReturnValue(query);

    await repository.findById(widget._id, session);

    expect(query.session).toHaveBeenCalledWith(session);
  });
});

describe('paginate', () => {
  it('applies first-page defaults and returns items with the total', async () => {
    const { model, repository } = setup();
    const itemsQuery = queryOf([widget]);
    model.find.mockReturnValue(itemsQuery);
    model.countDocuments.mockReturnValue(queryOf(1));

    const page = await repository.paginate();

    expect(itemsQuery.sort).toHaveBeenCalledWith({ _id: 1 });
    expect(itemsQuery.skip).toHaveBeenCalledWith(0);
    expect(itemsQuery.limit).toHaveBeenCalledWith(DEFAULT_PAGE_SIZE);
    expect(page).toStrictEqual({
      items: [widget],
      total: 1,
      page: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    });
  });

  it('offsets by the requested page and clamps the page size', async () => {
    const { model, repository } = setup();
    const itemsQuery = queryOf([]);
    model.find.mockReturnValue(itemsQuery);
    model.countDocuments.mockReturnValue(queryOf(0));

    const page = await repository.paginate({ page: 3, pageSize: MAX_PAGE_SIZE * 5 });

    expect(itemsQuery.skip).toHaveBeenCalledWith(2 * MAX_PAGE_SIZE);
    expect(itemsQuery.limit).toHaveBeenCalledWith(MAX_PAGE_SIZE);
    expect(page.pageSize).toBe(MAX_PAGE_SIZE);
  });

  it('passes the filter to both the list and the count query', async () => {
    const { model, repository } = setup();
    const itemsQuery = queryOf([]);
    const countQuery = queryOf(0);
    model.find.mockReturnValue(itemsQuery);
    model.countDocuments.mockReturnValue(countQuery);

    await repository.paginate({ filter: { name: 'widget' }, session });

    expect(model.find).toHaveBeenCalledWith({ name: 'widget' });
    expect(model.countDocuments).toHaveBeenCalledWith({ name: 'widget' });
    expect(itemsQuery.session).toHaveBeenCalledWith(session);
    expect(countQuery.session).toHaveBeenCalledWith(session);
  });
});

describe('updateWithVersion', () => {
  it('matches on id and expected version, increments the version, returns the new doc', async () => {
    const { model, repository } = setup();
    model.findOneAndUpdate.mockReturnValue(queryOf({ ...widget, version: 4 }));

    const result = await repository.updateWithVersion({
      id: widget._id,
      expectedVersion: 3,
      update: { name: 'renamed' },
      session,
    });

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: widget._id, version: 3 },
      { $set: { name: 'renamed' }, $inc: { version: 1 } },
      { new: true, session },
    );
    expect(result.version).toBe(4);
  });

  it('throws NotFoundError when no document matches because the id is gone', async () => {
    const { model, repository } = setup();
    model.findOneAndUpdate.mockReturnValue(queryOf(null));
    model.findById.mockReturnValue(queryOf(null));

    await expect(
      repository.updateWithVersion({ id: 'missing', expectedVersion: 1, update: {} }),
    ).rejects.toThrow(NotFoundError);
  });

  it('throws ConflictError when no document matches because the version moved on', async () => {
    const { model, repository } = setup();
    model.findOneAndUpdate.mockReturnValue(queryOf(null));
    model.findById.mockReturnValue(queryOf(widget));

    await expect(
      repository.updateWithVersion({ id: widget._id, expectedVersion: 1, update: {} }),
    ).rejects.toThrow(ConflictError);
  });
});
