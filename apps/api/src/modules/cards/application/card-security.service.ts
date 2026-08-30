import type { CardDetail, CardSensitiveDetails } from '@icb/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { PasswordService } from '../../auth/application/password.service.js';
import { assertCardAmendable } from '../domain/card-state.js';
import { decryptField } from '../domain/pan-cipher.js';
import { assertPinAllowed } from '../domain/pin-policy.js';
import { CardDoc } from '../infrastructure/card.schemas.js';
import { CardReader } from './card-reader.js';

/** How long the client may display a revealed PAN before it must blank the screen. */
const REVEAL_WINDOW_MS = 60_000;

/**
 * The two operations that touch a card's secrets.
 *
 * A PIN goes in through argon2 and never comes back out: `setPin` stores a hash and every read
 * path exposes only the boolean `pinSet`. There is deliberately no "what is my PIN" endpoint, and
 * no field anywhere that could grow into one.
 *
 * The full PAN comes back only to the card's owner, on an authenticated session.
 */
@Injectable()
export class CardSecurityService {
  private readonly logger = new Logger(CardSecurityService.name);

  constructor(
    @InjectModel(CardDoc.name) private readonly cards: Model<CardDoc>,
    private readonly reader: CardReader,
    private readonly passwords: PasswordService,
    @Inject(CONFIG) private readonly config: AppConfiguration,
    private readonly clock: ClockService,
  ) {}

  /** Set or change the card PIN. The plaintext exists only for the length of this call. */
  async setPin(cardId: string, customerId: string, pin: string): Promise<CardDetail> {
    const card = await this.reader.loadOwned(cardId, customerId);
    assertCardAmendable(card);
    assertPinAllowed(pin);

    await this.cards.updateOne(
      { _id: card._id },
      { $set: { pinHash: await this.passwords.hash(pin), pinSetAt: this.clock.now() } },
    );

    this.logger.log({ cardId: card._id }, 'Card PIN set');
    return this.reader.detailOwned(cardId, customerId);
  }

  /**
   * Staff PIN reset. Nothing is set in its place — clearing the hash is the entire operation, and
   * the customer chooses the new PIN themselves through the ordinary `setPin` path. Staff never
   * see, choose, or transmit a PIN.
   */
  async clearPin(cardId: string): Promise<CardDetail> {
    const card = await this.reader.loadById(cardId);
    assertCardAmendable(card);

    await this.cards.updateOne(
      { _id: card._id },
      { $set: { pinHash: null, pinSetAt: null } },
    );

    this.logger.log({ cardId: card._id }, 'Card PIN cleared by staff');
    return this.reader.detail(card);
  }

  /**
   * The full card details, for the card's owner.
   *
   * The response carries `hideAfter` so the client has an unambiguous deadline rather than its own
   * guess at how long a PAN may sit on screen.
   */
  async reveal(
    cardId: string,
    customerId: string,
    userId: string,
  ): Promise<CardSensitiveDetails> {
    const card = await this.reader.loadOwned(cardId, customerId);
    const key = this.config.crypto.fieldEncryptionKey;

    this.logger.warn({ cardId: card._id, userId }, 'Card details revealed');

    return {
      pan: decryptField(card.panEncrypted, key),
      cvv: decryptField(card.cvvEncrypted, key),
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      cardholderName: card.cardholderName,
      hideAfter: new Date(this.clock.epochMs() + REVEAL_WINDOW_MS).toISOString(),
    };
  }
}
