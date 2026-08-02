import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * The authorisation log.
 *
 * Every message from the card network is recorded, including the declines — a customer whose
 * payment failed at the till needs to see *that it failed and why*, and a fraud analyst needs the
 * attempts that never became transactions. Nothing here is ever deleted or rewritten: a capture
 * adds fields, it does not replace the authorisation.
 *
 * `holdId` links to the reservation on the customer's available balance and `transactionId` to the
 * ledger posting that eventually settled it. Both are null until the corresponding step happens,
 * which is exactly how the lifecycle reads back.
 */
@Schema({ collection: 'card_authorisations', timestamps: true, versionKey: false })
export class CardAuthorisationDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  cardId!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true, index: true })
  accountId!: string;

  @Prop({ type: String, required: true })
  merchantName!: string;

  @Prop({ type: String, required: true, index: true })
  mcc!: string;

  @Prop({ type: String, required: true })
  category!: string;

  @Prop({ type: String, required: true })
  channel!: string;

  @Prop({ type: String, default: null })
  country!: string | null;

  /** Amount requested by the merchant, in the card's billing currency. */
  @Prop({ type: Number, required: true })
  minorUnits!: number;

  /** Amount billed to the customer. Equal to `minorUnits` until FX or a partial capture applies. */
  @Prop({ type: Number, required: true })
  billingMinorUnits!: number;

  @Prop({ type: Number, default: null })
  capturedMinorUnits!: number | null;

  @Prop({ type: String, required: true })
  currency!: string;

  @Prop({ type: String, required: true, index: true })
  status!: string;

  @Prop({ type: String, default: null })
  declineReason!: string | null;

  @Prop({ type: String, default: null, index: true })
  arn!: string | null;

  @Prop({ type: String, default: null, index: true })
  holdId!: string | null;

  @Prop({ type: String, default: null, index: true })
  transactionId!: string | null;

  @Prop({ type: Date, required: true, index: true })
  authorisedAt!: Date;

  /** When an uncaptured authorisation stops reserving funds. Seven days, as on the card networks. */
  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  capturedAt!: Date | null;

  @Prop({ type: Date, default: null })
  reversedAt!: Date | null;
}

export type CardAuthorisationDocument = HydratedDocument<CardAuthorisationDoc>;
export const CardAuthorisationSchema = SchemaFactory.createForClass(CardAuthorisationDoc);
CardAuthorisationSchema.index({ cardId: 1, authorisedAt: -1 });
CardAuthorisationSchema.index({ customerId: 1, authorisedAt: -1 });
CardAuthorisationSchema.index({ status: 1, expiresAt: 1 });
CardAuthorisationSchema.index({ cardId: 1, status: 1, authorisedAt: -1 });
