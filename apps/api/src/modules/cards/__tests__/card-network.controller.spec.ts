import type { CardAuthorisation } from '@icb/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { CardAuthorisationLogService } from '../application/card-authorisation-log.service.js';
import type { CardAuthorisationService } from '../application/card-authorisation.service.js';
import type { CardCaptureService } from '../application/card-capture.service.js';
import { CardNetworkController } from '../card-network.controller.js';
import { AUTHORISATION_ID, CARD_ID } from './fixtures.js';

const AUTHORISATION = { id: AUTHORISATION_ID } as unknown as CardAuthorisation;

describe('CardNetworkController', () => {
  let authorisations: { authorise: ReturnType<typeof vi.fn> };
  let capture: { capture: ReturnType<typeof vi.fn>; reverse: ReturnType<typeof vi.fn> };
  let log: { expireDue: ReturnType<typeof vi.fn> };
  let controller: CardNetworkController;

  beforeEach(() => {
    authorisations = { authorise: vi.fn().mockResolvedValue(AUTHORISATION) };
    capture = {
      capture: vi.fn().mockResolvedValue(AUTHORISATION),
      reverse: vi.fn().mockResolvedValue(AUTHORISATION),
    };
    log = { expireDue: vi.fn().mockResolvedValue(3) };

    controller = new CardNetworkController(
      authorisations as unknown as CardAuthorisationService,
      capture as unknown as CardCaptureService,
      log as unknown as CardAuthorisationLogService,
    );
  });

  it('forwards the network authorisation request verbatim', async () => {
    const body = {
      merchantName: 'Shoprite Accra',
      mcc: '5411',
      amount: { minorUnits: 25_000, currency: 'USD', scale: 2 },
      channel: 'in_store',
      country: 'GH',
    };

    const result = await controller.authorise(CARD_ID, body as never);

    expect(authorisations.authorise).toHaveBeenCalledWith(CARD_ID, body);
    expect(result).toBe(AUTHORISATION);
  });

  it('captures the full amount when the body carries none', async () => {
    const result = await controller.captureAuthorisation(AUTHORISATION_ID, {});

    expect(capture.capture).toHaveBeenCalledWith(AUTHORISATION_ID, undefined);
    expect(result).toBe(AUTHORISATION);
  });

  it('captures a partial amount in minor units', async () => {
    const body = { amount: { minorUnits: 10_000, currency: 'USD', scale: 2 } };

    await controller.captureAuthorisation(AUTHORISATION_ID, body as never);

    expect(capture.capture).toHaveBeenCalledWith(AUTHORISATION_ID, 10_000);
  });

  it('reverses an authorisation', async () => {
    const result = await controller.reverseAuthorisation(AUTHORISATION_ID);

    expect(capture.reverse).toHaveBeenCalledWith(AUTHORISATION_ID);
    expect(result).toBe(AUTHORISATION);
  });

  it('sweeps expired authorisations and reports the count', async () => {
    const result = await controller.expire();

    expect(log.expireDue).toHaveBeenCalledOnce();
    expect(result).toEqual({ expired: 3 });
  });
});
