import { describe, expect, it, vi } from 'vitest';

import { ROLES_KEY } from '../../../common/decorators/roles.decorator.js';
import { JournalController } from '../journal/journal.controller.js';
import type { JournalService } from '../journal/journal.service.js';

function setup() {
  const journal = {
    query: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
    detail: vi.fn().mockResolvedValue({ transactionId: '01JT1' }),
  };
  const controller = new JournalController(journal as unknown as JournalService);
  return { controller, journal };
}

describe('JournalController', () => {
  it('is restricted to back-office roles', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, JournalController) as string[];

    expect(roles).toEqual(['operations', 'compliance', 'admin', 'super_admin']);
  });

  it('delegates the validated list query to the journal service', async () => {
    const { controller, journal } = setup();
    const query = { limit: 10, type: 'deposit' as const };

    const page = await controller.list(query);

    expect(journal.query).toHaveBeenCalledWith(query);
    expect(page.items).toEqual([]);
  });

  it('delegates a detail lookup to the journal service', async () => {
    const { controller, journal } = setup();

    const detail = await controller.detail('01JT1');

    expect(journal.detail).toHaveBeenCalledWith('01JT1');
    expect(detail.transactionId).toBe('01JT1');
  });
});
