import type { Model } from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DomainError } from '../../../common/errors/index.js';
import { type AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { type PasswordService } from '../../auth/application/password.service.js';
import { type CardReader } from '../application/card-reader.js';
import { CardSecurityService } from '../application/card-security.service.js';
import { encryptField } from '../domain/pan-cipher.js';
import type { CardDoc } from '../infrastructure/card.schemas.js';
import { CARD_ID, CUSTOMER_ID, NOW, cardDoc } from './fixtures.js';

const USER_ID = 'user-1';
const KEY = 'ab'.repeat(32);
const PAN = '4242424242424242';
const CVV = '123';

function setup(card: CardDoc) {
  const model = { updateOne: vi.fn().mockResolvedValue({ matchedCount: 1 }) };
  const reader = {
    loadOwned: vi.fn().mockResolvedValue(card),
    loadById: vi.fn().mockResolvedValue(card),
    detail: vi.fn().mockResolvedValue({ id: card._id }),
    detailOwned: vi.fn().mockResolvedValue({ id: card._id }),
  };
  const passwords = { hash: vi.fn().mockResolvedValue('argon2:new-hash') };
  const config = { crypto: { fieldEncryptionKey: KEY } } as unknown as AppConfiguration;
  const clock = new ClockService();
  clock.freeze(NOW);

  const service = new CardSecurityService(
    model as unknown as Model<CardDoc>,
    reader as unknown as CardReader,
    passwords as unknown as PasswordService,
    config,
    clock,
  );
  return { service, model, reader, passwords };
}

function sealedCard(): CardDoc {
  return cardDoc({ panEncrypted: encryptField(PAN, KEY), cvvEncrypted: encryptField(CVV, KEY) });
}

describe('CardSecurityService.setPin', () => {
  let deps: ReturnType<typeof setup>;

  beforeEach(() => {
    deps = setup(cardDoc());
  });

  it('stores only the argon2 hash and stamps when the PIN was set', async () => {
    const result = await deps.service.setPin(CARD_ID, CUSTOMER_ID, '5931');

    expect(deps.passwords.hash).toHaveBeenCalledWith('5931');
    expect(deps.model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      { $set: { pinHash: 'argon2:new-hash', pinSetAt: NOW } },
    );
    expect(result).toEqual({ id: CARD_ID });
  });

  it.each(['1234', '1111', '1212'])('rejects the trivial PIN %s before any write', async (pin) => {
    await expect(deps.service.setPin(CARD_ID, CUSTOMER_ID, pin)).rejects.toMatchObject({
      code: 'PIN_POLICY_VIOLATION',
    });
    expect(deps.passwords.hash).not.toHaveBeenCalled();
    expect(deps.model.updateOne).not.toHaveBeenCalled();
  });

  it('refuses to set a PIN on a cancelled card', async () => {
    const { service, passwords } = setup(cardDoc({ status: 'cancelled' }));

    await expect(service.setPin(CARD_ID, CUSTOMER_ID, '5931')).rejects.toThrow(DomainError);
    expect(passwords.hash).not.toHaveBeenCalled();
  });
});

describe('CardSecurityService.clearPin', () => {
  it('clears the hash without setting anything in its place', async () => {
    const { service, model, reader } = setup(cardDoc());

    await service.clearPin(CARD_ID);

    expect(model.updateOne).toHaveBeenCalledWith(
      { _id: CARD_ID },
      { $set: { pinHash: null, pinSetAt: null } },
    );
    expect(reader.detail).toHaveBeenCalledWith(cardDoc());
  });

  it('refuses to clear a PIN on a reported card', async () => {
    const { service, model } = setup(cardDoc({ status: 'stolen' }));

    await expect(service.clearPin(CARD_ID)).rejects.toThrow(DomainError);
    expect(model.updateOne).not.toHaveBeenCalled();
  });
});

describe('CardSecurityService.reveal', () => {
  it('opens the sealed PAN and CVV for the card owner', async () => {
    const deps = setup(sealedCard());

    const result = await deps.service.reveal(CARD_ID, CUSTOMER_ID, USER_ID);

    expect(deps.reader.loadOwned).toHaveBeenCalledWith(CARD_ID, CUSTOMER_ID);
    expect(result).toEqual({
      pan: PAN,
      cvv: CVV,
      expiryMonth: 8,
      expiryYear: 2029,
      cardholderName: 'AMA MENSAH',
      hideAfter: new Date(NOW.getTime() + 60_000).toISOString(),
    });
  });
});
