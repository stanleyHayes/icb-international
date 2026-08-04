import type { CardAuthorisation, CardDetail } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import type { CardAuthorisationLogService } from '../application/card-authorisation-log.service.js';
import { CardsStaffController } from '../cards-staff.controller.js';
import type { CardsStaffService } from '../cards-staff.service.js';
import { AUTHORISATION_ID, CARD_ID } from './fixtures.js';

const DETAIL = { id: CARD_ID } as unknown as CardDetail;
const AUTHORISATION = { id: AUTHORISATION_ID } as unknown as CardAuthorisation;

const STAFF_USER: AccessTokenClaims = {
  sub: 'staff-1',
  customerId: null,
  email: 'fraud@icb.example',
  roles: ['fraud_analyst'],
  sessionId: 'sess-1',
};

describe('CardsStaffController', () => {
  let staff: Record<
    'list' | 'issue' | 'detail' | 'block' | 'reissue' | 'resetPin' | 'updateLimits' | 'expireAuthorisation',
    ReturnType<typeof vi.fn>
  >;
  let log: { listForCardAsStaff: ReturnType<typeof vi.fn> };
  let controller: CardsStaffController;

  beforeEach(() => {
    staff = {
      list: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
      issue: vi.fn().mockResolvedValue(DETAIL),
      detail: vi.fn().mockResolvedValue(DETAIL),
      block: vi.fn().mockResolvedValue(DETAIL),
      reissue: vi.fn().mockResolvedValue(DETAIL),
      resetPin: vi.fn().mockResolvedValue(DETAIL),
      updateLimits: vi.fn().mockResolvedValue(DETAIL),
      expireAuthorisation: vi.fn().mockResolvedValue(AUTHORISATION),
    };
    log = { listForCardAsStaff: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: true }) };

    controller = new CardsStaffController(
      staff as unknown as CardsStaffService,
      log as unknown as CardAuthorisationLogService,
    );
  });

  it('lists cards across customers with the parsed query', async () => {
    const query = { status: 'active' };

    const page = await controller.list(query as never);

    expect(staff.list).toHaveBeenCalledWith(query);
    expect(page.hasMore).toBe(false);
  });

  it('issues a card from the staff console', async () => {
    const body = { customerId: 'cust-9', accountId: 'acct-9', kind: 'debit' };

    const result = await controller.issue(body as never);

    expect(staff.issue).toHaveBeenCalledWith(body);
    expect(result).toBe(DETAIL);
  });

  it('reads a card detail without a customer scope', async () => {
    const result = await controller.detail(CARD_ID);

    expect(staff.detail).toHaveBeenCalledWith(CARD_ID);
    expect(result).toBe(DETAIL);
  });

  it('blocks with the reason and the staff member who acted', async () => {
    const result = await controller.block(STAFF_USER, CARD_ID, { reason: 'Suspected fraud' });

    expect(staff.block).toHaveBeenCalledWith(CARD_ID, 'Suspected fraud', 'staff-1');
    expect(result).toBe(DETAIL);
  });

  it('reissues a card', async () => {
    const body = { reason: 'damaged' };

    const result = await controller.reissue(CARD_ID, body as never);

    expect(staff.reissue).toHaveBeenCalledWith(CARD_ID, body);
    expect(result).toBe(DETAIL);
  });

  it('resets the PIN without a body', async () => {
    const result = await controller.resetPin(CARD_ID);

    expect(staff.resetPin).toHaveBeenCalledWith(CARD_ID);
    expect(result).toBe(DETAIL);
  });

  it('updates limits as staff', async () => {
    const body = { dailySpend: { minorUnits: 200_000, currency: 'USD', scale: 2 } };

    const result = await controller.updateLimits(CARD_ID, body as never);

    expect(staff.updateLimits).toHaveBeenCalledWith(CARD_ID, body);
    expect(result).toBe(DETAIL);
  });

  it('lists authorisations without a customer scope', async () => {
    const query = { limit: 5 };

    const page = await controller.authorisations(CARD_ID, query);

    expect(log.listForCardAsStaff).toHaveBeenCalledWith(CARD_ID, query);
    expect(page.hasMore).toBe(true);
  });

  it('force-expires an authorisation with the given reason', async () => {
    const result = await controller.expireAuthorisation(CARD_ID, AUTHORISATION_ID, {
      reason: 'Merchant unresponsive',
    });

    expect(staff.expireAuthorisation).toHaveBeenCalledWith(
      CARD_ID,
      AUTHORISATION_ID,
      'Merchant unresponsive',
    );
    expect(result).toBe(AUTHORISATION);
  });
});
