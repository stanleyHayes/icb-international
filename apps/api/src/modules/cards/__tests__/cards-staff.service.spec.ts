import type { CardDetail, CursorPage } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../../common/errors/index.js';
import type { CardCaptureService } from '../application/card-capture.service.js';
import type { CardIssuanceService } from '../application/card-issuance.service.js';
import { cardNotFound, type CardReader } from '../application/card-reader.js';
import type { CardSecurityService } from '../application/card-security.service.js';
import type { CardSettingsService } from '../application/card-settings.service.js';
import { CardsStaffService } from '../cards-staff.service.js';
import type { CardsService } from '../cards.service.js';
import { ACCOUNT_ID, CARD_ID, cardDoc } from './fixtures.js';

const STAFF_ID = 'staff-ops-1';
const REASON = 'Confirmed fraud on the account';
const DETAIL = { id: CARD_ID } as unknown as CardDetail;

function setup() {
  const reader = {
    listAll: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }),
    loadById: vi.fn().mockResolvedValue(cardDoc()),
    detail: vi.fn().mockResolvedValue(DETAIL),
  };
  const issuance = { issueAsStaff: vi.fn().mockResolvedValue(DETAIL) };
  const lifecycle = {
    blockAsStaff: vi.fn().mockResolvedValue(DETAIL),
    reportAsStaff: vi.fn().mockResolvedValue(DETAIL),
  };
  const security = { clearPin: vi.fn().mockResolvedValue(DETAIL) };
  const settings = { updateLimitsAsStaff: vi.fn().mockResolvedValue(DETAIL) };
  const capture = { expireForCard: vi.fn() };

  const service = new CardsStaffService(
    reader as unknown as CardReader,
    issuance as unknown as CardIssuanceService,
    lifecycle as unknown as CardsService,
    security as unknown as CardSecurityService,
    settings as unknown as CardSettingsService,
    capture as unknown as CardCaptureService,
  );
  return { service, reader, issuance, lifecycle, security, settings, capture };
}

describe('CardsStaffService', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup();
  });

  describe('list', () => {
    it('delegates to the unscoped reader page', async () => {
      const page: CursorPage<never> = { items: [], nextCursor: 'cur-1', hasMore: true };
      deps.reader.listAll.mockResolvedValue(page);
      const query = { limit: 25, status: ['active' as const] };

      const result = await deps.service.list(query);

      expect(deps.reader.listAll).toHaveBeenCalledWith(query);
      expect(result).toBe(page);
    });
  });

  describe('detail', () => {
    it('loads by id without an ownership scope', async () => {
      await expect(deps.service.detail(CARD_ID)).resolves.toBe(DETAIL);
      expect(deps.reader.loadById).toHaveBeenCalledWith(CARD_ID);
      expect(deps.reader.detail).toHaveBeenCalledWith(cardDoc());
    });

    it('propagates the typed not-found for an unknown card', async () => {
      deps.reader.loadById.mockRejectedValue(cardNotFound(CARD_ID));
      await expect(deps.service.detail(CARD_ID)).rejects.toThrow(DomainError);
      expect(deps.reader.detail).not.toHaveBeenCalled();
    });
  });

  describe('issue', () => {
    it('lets issuance resolve the owning customer from the account, never from the client', async () => {
      const request = {
        accountId: ACCOUNT_ID,
        kind: 'debit' as const,
        network: 'visa' as const,
        deliveryAddressId: 'residential' as const,
      };

      await expect(deps.service.issue(request)).resolves.toBe(DETAIL);
      expect(deps.issuance.issueAsStaff).toHaveBeenCalledWith(request);
    });
  });

  describe('block', () => {
    it('passes the staff member through as the actor', async () => {
      await expect(deps.service.block(CARD_ID, REASON, STAFF_ID)).resolves.toBe(DETAIL);
      expect(deps.lifecycle.blockAsStaff).toHaveBeenCalledWith(CARD_ID, REASON, STAFF_ID);
    });
  });

  describe('reissue', () => {
    it('reports the card through the shared lifecycle with a replacement always minted', async () => {
      const request = { reason: 'stolen' as const, detail: 'Card taken in a robbery' };

      await expect(deps.service.reissue(CARD_ID, request)).resolves.toBe(DETAIL);
      expect(deps.lifecycle.reportAsStaff).toHaveBeenCalledWith(CARD_ID, {
        ...request,
        reissue: true,
      });
    });
  });

  describe('resetPin', () => {
    it('clears the PIN through the security service', async () => {
      await expect(deps.service.resetPin(CARD_ID)).resolves.toBe(DETAIL);
      expect(deps.security.clearPin).toHaveBeenCalledWith(CARD_ID);
    });
  });

  describe('updateLimits', () => {
    it('delegates to the settings service without an ownership scope', async () => {
      const request = { daily: { minorUnits: 100_000, currency: 'USD' as const, scale: 2 } };
      await deps.service.updateLimits(CARD_ID, request);
      expect(deps.settings.updateLimitsAsStaff).toHaveBeenCalledWith(CARD_ID, request);
    });
  });

  describe('expireAuthorisation', () => {
    it('delegates the force-expire to the capture service with the staff reason', async () => {
      await deps.service.expireAuthorisation(CARD_ID, 'auth-1', REASON);
      expect(deps.capture.expireForCard).toHaveBeenCalledWith(CARD_ID, 'auth-1', REASON);
    });
  });
});
