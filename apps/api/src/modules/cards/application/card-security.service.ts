import type { CardDetail, CardSensitiveDetails } from '@icb/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { StepUpRequiredError } from '../../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { PasswordService } from '../../auth/application/password.service.js';
import { TokenService } from '../../auth/application/token.service.js';
import { assertCardAmendable } from '../domain/card-state.js';
import { decryptField } from '../domain/pan-cipher.js';
import { assertPinAllowed } from '../domain/pin-policy.js';
import { CardDoc } from '../infrastructure/card.schemas.js';
import { CardReader } from './card-reader.js';

/** The purpose a step-up token must have been minted for to open a card's full details. */
export const PAN_REVEAL_PURPOSE = 'card_pan_reveal';

/** How long the client may display a revealed PAN before it must blank the screen. */
const REVEAL_WINDOW_MS = 60_000;

/**
 * The two operations that touch a card's secrets.
 *
 * A PIN goes in through argon2 and never comes back out: `setPin` stores a hash and every read
 * path exposes only the boolean `pinSet`. There is deliberately no "what is my PIN" endpoint, and
 * no field anywhere that could grow into one.
 *
 * The full PAN comes back only behind a fresh step-up token bound to the same principal. Without
 * that binding, a token stolen from one session would open every card the attacker could name.
 */
@Injectable()
export class CardSecurityService {
  private readonly logger = new Logger(CardSecurityService.name);

  constructor(
    @InjectModel(CardDoc.name) private readonly cards: Model<CardDoc>,
    private readonly reader: CardReader,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
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
   * The full card details, behind step-up.
   *
   * The response carries `hideAfter` so the client has an unambiguous deadline rather than its own
   * guess at how long a PAN may sit on screen.
   */
  async reveal(
    cardId: string,
    customerId: string,
    userId: string,
    stepUpToken: string | undefined,
  ): Promise<CardSensitiveDetails> {
    await this.assertStepUp(stepUpToken, userId);

    const card = await this.reader.loadOwned(cardId, customerId);
    const key = this.config.crypto.fieldEncryptionKey;

    this.logger.warn({ cardId: card._id, userId }, 'Card details revealed under step-up');

    return {
      pan: decryptField(card.panEncrypted, key),
      cvv: decryptField(card.cvvEncrypted, key),
      expiryMonth: card.expiryMonth,
      expiryYear: card.expiryYear,
      cardholderName: card.cardholderName,
      hideAfter: new Date(this.clock.epochMs() + REVEAL_WINDOW_MS).toISOString(),
    };
  }

  /**
   * A step-up token is accepted only when it verifies *and* belongs to the caller. Every failure —
   * missing, malformed, expired, someone else's — returns the same STEP_UP_REQUIRED, so the header
   * cannot be used to probe which tokens exist.
   */
  private async assertStepUp(token: string | undefined, userId: string): Promise<void> {
    if (!token) {
      throw new StepUpRequiredError(PAN_REVEAL_PURPOSE);
    }

    try {
      const claims = await this.tokens.verifyStepUpToken(token);
      if (claims.sub !== userId) {
        throw new StepUpRequiredError(PAN_REVEAL_PURPOSE);
      }
    } catch {
      throw new StepUpRequiredError(PAN_REVEAL_PURPOSE);
    }
  }
}
