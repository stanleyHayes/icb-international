import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';
import type { CardControlsDoc, CardLimitsDoc } from '../domain/card-defaults.js';

/**
 * Card persistence.
 *
 * Note what is stored and what is not. `panEncrypted` and `cvvEncrypted` are AES-256-GCM
 * ciphertext; `panFingerprint` is a keyed digest that exists purely so uniqueness can be enforced
 * without indexing the number itself; `pinHash` is argon2 and the PIN is never held anywhere else,
 * in any form, at any point after the request that set it. Everything a read path needs —
 * `panLast4`, the expiry — is stored separately so no ordinary query ever has to decrypt.
 */
@Schema({ collection: 'cards', timestamps: true, versionKey: false })
export class CardDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true, index: true })
  accountId!: string;

  @Prop({ type: String, required: true, index: true })
  kind!: string;

  @Prop({ type: String, required: true })
  network!: string;

  @Prop({ type: String, required: true, index: true })
  status!: string;

  @Prop({ type: String, default: null })
  nickname!: string | null;

  @Prop({ type: String, required: true })
  cardholderName!: string;

  @Prop({ type: String, required: true })
  panEncrypted!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  panFingerprint!: string;

  @Prop({ type: String, required: true })
  panLast4!: string;

  @Prop({ type: String, required: true })
  cvvEncrypted!: string;

  @Prop({ type: Number, required: true })
  expiryMonth!: number;

  @Prop({ type: Number, required: true })
  expiryYear!: number;

  @Prop({ type: String, required: true })
  currency!: string;

  /**
   * The country the card was issued in. Stored on the card rather than read from configuration at
   * authorisation time so that "is this transaction abroad?" is answered against the card's own
   * origin, and stays correct for cards issued before the bank ever opened a second market.
   */
  @Prop({ type: String, required: true })
  issuingCountry!: string;

  @Prop({ type: Boolean, required: true, default: false })
  frozen!: boolean;

  @Prop({ type: Boolean, required: true, default: true })
  contactlessEnabled!: boolean;

  @Prop({ type: String, default: null })
  pinHash!: string | null;

  @Prop({ type: Date, default: null })
  pinSetAt!: Date | null;

  @Prop({ type: Object, required: true })
  controls!: CardControlsDoc;

  @Prop({ type: Object, required: true })
  limits!: CardLimitsDoc;

  @Prop({ type: String, required: true, default: 'residential' })
  deliveryAddressId!: string;

  @Prop({ type: Date, required: true })
  issuedAt!: Date;

  @Prop({ type: Date, default: null })
  activatedAt!: Date | null;

  @Prop({ type: Date, default: null })
  cancelledAt!: Date | null;

  @Prop({ type: String, default: null })
  cancellationReason!: string | null;

  /** The card this one replaces. Set on the *new* card, so a chain reads newest → oldest. */
  @Prop({ type: String, default: null, index: true })
  replacedCardId!: string | null;

  @Prop({ type: String, default: null })
  replacedByCardId!: string | null;

  @Prop({ type: Date, default: null })
  travelNoticeFrom!: Date | null;

  @Prop({ type: Date, default: null })
  travelNoticeUntil!: Date | null;

  @Prop({ type: [String], default: [] })
  travelCountries!: string[];

  @Prop({ type: String, default: null })
  reportedReason!: string | null;

  @Prop({ type: Date, default: null })
  reportedAt!: Date | null;
}

export type CardDocument = HydratedDocument<CardDoc>;
export const CardSchema = SchemaFactory.createForClass(CardDoc);
CardSchema.index({ customerId: 1, status: 1 });
CardSchema.index({ accountId: 1, status: 1 });
CardSchema.index({ customerId: 1, issuedAt: -1 });
