import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';
import { MICRO_DEPOSIT_ATTEMPTS } from '../domain/micro-deposit.js';
import { VERIFICATION_STATES } from '../domain/verification-state.js';

/**
 * A saved payee.
 *
 * `addedAt` rather than `createdAt` on purpose: Mongoose's own `timestamps` write wall-clock
 * time, and every fraud control in this module is measured against the *simulated* clock. Two
 * fields with the same name and different notions of "now" is exactly the bug that makes a
 * cooling-off window silently expire the moment it is created.
 *
 * The expected micro-deposit amounts are stored only as an HMAC — see `micro-deposit.ts`.
 */
@Schema({ collection: 'beneficiaries', timestamps: true, versionKey: false })
export class BeneficiaryDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, default: null })
  nickname!: string | null;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: Object, required: true })
  destination!: Record<string, unknown>;

  /** Normalised destination identifier. Unique per customer — this is the dedupe. */
  @Prop({ type: String, required: true })
  destinationKey!: string;

  @Prop({ type: String, required: true })
  displayIdentifier!: string;

  @Prop({ type: String, default: null })
  bankName!: string | null;

  @Prop({ type: String, default: null })
  currency!: string | null;

  /** Set when the destination resolves to an ICB account, which is what makes deposits postable. */
  @Prop({ type: String, default: null })
  icbAccountId!: string | null;

  @Prop({ type: Boolean, required: true, default: false, index: true })
  verified!: boolean;

  @Prop({ type: Boolean, required: true, default: false })
  favourite!: boolean;

  @Prop({ type: Date, required: true })
  coolingOffUntil!: Date;

  @Prop({ type: Date, default: null })
  lastUsedAt!: Date | null;

  @Prop({ type: Number, required: true, default: 0 })
  useCount!: number;

  @Prop({ type: Date, required: true })
  addedAt!: Date;

  @Prop({ type: String, required: true, default: VERIFICATION_STATES.NOT_STARTED })
  verificationState!: string;

  @Prop({ type: Number, required: true, default: MICRO_DEPOSIT_ATTEMPTS })
  verificationAttemptsRemaining!: number;

  @Prop({ type: String, default: null })
  verificationHash!: string | null;

  @Prop({ type: Date, default: null })
  depositsSentAt!: Date | null;

  @Prop({ type: Date, default: null })
  verifiedAt!: Date | null;

  @Prop({ type: [String], default: [] })
  microDepositTransactionIds!: string[];
}

export type BeneficiaryDocument = HydratedDocument<BeneficiaryDoc>;
export const BeneficiarySchema = SchemaFactory.createForClass(BeneficiaryDoc);

// One payee per destination per customer. Enforced by the database, not just by a read-then-write.
BeneficiarySchema.index({ customerId: 1, destinationKey: 1 }, { unique: true });
BeneficiarySchema.index({ customerId: 1, favourite: -1, _id: 1 });
