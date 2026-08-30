import type { CardDetail, CardSensitiveDetails } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import type { CardAuthorisationLogService } from '../application/card-authorisation-log.service.js';
import type { CardSecurityService } from '../application/card-security.service.js';
import type { CardSettingsService } from '../application/card-settings.service.js';
import { CardSettingsController } from '../card-settings.controller.js';
import { CARD_ID, CUSTOMER_ID } from './fixtures.js';

const DETAIL = { id: CARD_ID } as unknown as CardDetail;
const SENSITIVE = { pan: '4242424242424242' } as unknown as CardSensitiveDetails;

const USER: AccessTokenClaims = {
  sub: 'user-1',
  customerId: CUSTOMER_ID,
  email: 'ama@example.com',
  roles: ['customer'],
  sessionId: 'sess-1',
};

describe('CardSettingsController', () => {
  let settings: Record<'updateControls' | 'updateLimits' | 'travelNotice', ReturnType<typeof vi.fn>>;
  let security: { setPin: ReturnType<typeof vi.fn>; reveal: ReturnType<typeof vi.fn> };
  let log: { listForCard: ReturnType<typeof vi.fn> };
  let controller: CardSettingsController;

  beforeEach(() => {
    settings = {
      updateControls: vi.fn().mockResolvedValue(DETAIL),
      updateLimits: vi.fn().mockResolvedValue(DETAIL),
      travelNotice: vi.fn().mockResolvedValue(DETAIL),
    };
    security = {
      setPin: vi.fn().mockResolvedValue(DETAIL),
      reveal: vi.fn().mockResolvedValue(SENSITIVE),
    };
    log = { listForCard: vi.fn().mockResolvedValue({ items: [], nextCursor: null, hasMore: false }) };

    controller = new CardSettingsController(
      settings as unknown as CardSettingsService,
      security as unknown as CardSecurityService,
      log as unknown as CardAuthorisationLogService,
    );
  });

  it('updates controls scoped by the token customer', async () => {
    const body = { onlinePayments: false };

    const result = await controller.updateControls(CUSTOMER_ID, CARD_ID, body as never);

    expect(settings.updateControls).toHaveBeenCalledWith(CARD_ID, CUSTOMER_ID, body);
    expect(result).toBe(DETAIL);
  });

  it('updates limits scoped by the token customer', async () => {
    const body = { dailySpend: { minorUnits: 100_000, currency: 'USD', scale: 2 } };

    const result = await controller.updateLimits(CUSTOMER_ID, CARD_ID, body as never);

    expect(settings.updateLimits).toHaveBeenCalledWith(CARD_ID, CUSTOMER_ID, body);
    expect(result).toBe(DETAIL);
  });

  it('passes only the PIN digits to the security service', async () => {
    const result = await controller.setPin(CUSTOMER_ID, CARD_ID, { pin: '1849' });

    expect(security.setPin).toHaveBeenCalledWith(CARD_ID, CUSTOMER_ID, '1849');
    expect(result).toBe(DETAIL);
  });

  it('registers a travel notice', async () => {
    const body = { from: '2026-09-01', until: '2026-09-15', countries: ['FR'] };

    const result = await controller.travelNotice(CUSTOMER_ID, CARD_ID, body as never);

    expect(settings.travelNotice).toHaveBeenCalledWith(CARD_ID, CUSTOMER_ID, body);
    expect(result).toBe(DETAIL);
  });

  it('lists the authorisation history scoped by the token customer', async () => {
    const query = { limit: 25 };

    const page = await controller.authorisations(CUSTOMER_ID, CARD_ID, query);

    expect(log.listForCard).toHaveBeenCalledWith(CARD_ID, CUSTOMER_ID, query);
    expect(page.hasMore).toBe(false);
  });

  it('reveals the PAN for the calling principal', async () => {
    const result = await controller.sensitive(USER, CUSTOMER_ID, CARD_ID);

    expect(security.reveal).toHaveBeenCalledWith(CARD_ID, CUSTOMER_ID, 'user-1');
    expect(result).toBe(SENSITIVE);
  });
});
