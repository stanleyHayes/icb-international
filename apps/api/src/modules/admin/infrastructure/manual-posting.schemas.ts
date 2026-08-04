import type { EntryDirection } from '@icb/contracts';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/** Lifecycle: parked awaiting a second operator, claimed by the sweep, then posted. */
export const MANUAL_POSTING_STATUSES = ['awaiting_approval', 'posting', 'posted'] as const;
export type ManualPostingStatus = (typeof MANUAL_POSTING_STATUSES)[number];

/**
 * Tracking document for a manual credit/debit.
 *
 * A manual posting never exists as a bare ledger write: this row is the durable link between
 * the approval that authorised it and the transaction it became. The unique `approvalId`
 * index makes one-approval-one-posting a database guarantee, and the `awaiting_approval →
 * posting` claim is the idempotency guard that keeps a retried sweep from posting twice.
 */
@Schema({ collection: 'manual_postings', timestamps: true, versionKey: false })
export class ManualPostingDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  /** The approval that authorised this posting. Unique: one decision, one posting. */
  @Prop({ type: String, required: true, unique: true, index: true })
  approvalId!: string;

  @Prop({ type: String, required: true, index: true })
  accountId!: string;

  /** Direction applied to the customer account; the GL contra leg is always the mirror. */
  @Prop({ type: String, required: true })
  direction!: EntryDirection;

  @Prop({ type: Number, required: true })
  minorUnits!: number;

  @Prop({ type: String, required: true })
  currency!: string;

  /** Four-digit chart-of-accounts code forming the other leg. */
  @Prop({ type: String, required: true })
  contraAccountCode!: string;

  @Prop({ type: String, required: true })
  description!: string;

  @Prop({ type: String, required: true })
  reason!: string;

  /** Optional back-dating (`YYYY-MM-DD`); null books on the current business date. */
  @Prop({ type: String, default: null })
  valueDate!: string | null;

  @Prop({ type: String, required: true, default: 'awaiting_approval', index: true })
  status!: ManualPostingStatus;

  @Prop({ type: String, default: null })
  transactionId!: string | null;

  /** Staff id of the maker — taken from the token, never from request input. */
  @Prop({ type: String, required: true })
  requestedBy!: string;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ManualPostingDocument = HydratedDocument<ManualPostingDoc>;
export const ManualPostingSchema = SchemaFactory.createForClass(ManualPostingDoc);
