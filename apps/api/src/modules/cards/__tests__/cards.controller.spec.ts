import type { CardDetail } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CardsController } from '../cards.controller.js';
import type { CardsService } from '../cards.service.js';
import { CARD_ID, CUSTOMER_ID } from './fixtures.js';

const DETAIL = { id: CARD_ID, customerId: CUSTOMER_ID } as unknown as CardDetail;

describe('CardsController', () => {
  let cards: Record<
    'list' | 'issue' | 'detail' | 'update' | 'activate' | 'setFrozen' | 'cancel' | 'report',
    ReturnType<typeof vi.fn>
  >;
  let controller: CardsController;

  beforeEach(() => {
    cards = {
      list: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
      issue: vi.fn().mockResolvedValue(DETAIL),
      detail: vi.fn().mockResolvedValue(DETAIL),
      update: vi.fn().mockResolvedValue(DETAIL),
      activate: vi.fn().mockResolvedValue(DETAIL),
      setFrozen: vi.fn().mockResolvedValue(DETAIL),
      cancel: vi.fn().mockResolvedValue(DETAIL),
      report: vi.fn().mockResolvedValue(DETAIL),
    };
    controller = new CardsController(cards as unknown as CardsService);
  });

  it('lists cards for the token customer with the parsed query', async () => {
    const query = { limit: 10 };

    const page = await controller.list(CUSTOMER_ID, query);

    expect(cards.list).toHaveBeenCalledWith(CUSTOMER_ID, query);
    expect(page.hasMore).toBe(false);
  });

  it('issues a card for the token customer', async () => {
    const body = { accountId: 'acct-1', kind: 'debit' };

    const result = await controller.issue(CUSTOMER_ID, body as never);

    expect(cards.issue).toHaveBeenCalledWith(CUSTOMER_ID, body);
    expect(result).toBe(DETAIL);
  });

  it('reads the detail scoped by the token customer', async () => {
    const result = await controller.detail(CUSTOMER_ID, CARD_ID);

    expect(cards.detail).toHaveBeenCalledWith(CARD_ID, CUSTOMER_ID);
    expect(result).toBe(DETAIL);
  });

  it('updates the card through the service', async () => {
    const body = { nickname: 'Everyday' };

    const result = await controller.update(CUSTOMER_ID, CARD_ID, body);

    expect(cards.update).toHaveBeenCalledWith(CARD_ID, CUSTOMER_ID, body);
    expect(result).toBe(DETAIL);
  });

  it('activates the card', async () => {
    const result = await controller.activate(CUSTOMER_ID, CARD_ID);

    expect(cards.activate).toHaveBeenCalledWith(CARD_ID, CUSTOMER_ID);
    expect(result).toBe(DETAIL);
  });

  it('freezes the card when the flag is set', async () => {
    const result = await controller.freeze(CUSTOMER_ID, CARD_ID, { frozen: true });

    expect(cards.setFrozen).toHaveBeenCalledWith(CARD_ID, CUSTOMER_ID, true);
    expect(result).toBe(DETAIL);
  });

  it('unfreezes the card when the flag is cleared', async () => {
    await controller.freeze(CUSTOMER_ID, CARD_ID, { frozen: false });

    expect(cards.setFrozen).toHaveBeenCalledWith(CARD_ID, CUSTOMER_ID, false);
  });

  it('cancels with the parsed reason', async () => {
    const result = await controller.cancel(CUSTOMER_ID, CARD_ID, { reason: 'No longer needed' });

    expect(cards.cancel).toHaveBeenCalledWith(CARD_ID, CUSTOMER_ID, 'No longer needed');
    expect(result).toBe(DETAIL);
  });

  it('reports the card and returns the replacement detail', async () => {
    const body = { reason: 'lost', replace: true };

    const result = await controller.report(CUSTOMER_ID, CARD_ID, body as never);

    expect(cards.report).toHaveBeenCalledWith(CARD_ID, CUSTOMER_ID, body);
    expect(result).toBe(DETAIL);
  });
});
