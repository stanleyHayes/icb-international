import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * Customer-supplied layer on top of a transaction: a note, tags, a category override, and
 * attachments. Kept out of `ledger_entries` because postings are immutable (agent_plan.md N5)
 * while an annotation is the customer's own marginalia — editable forever, never financial.
 *
 * Attachments are stored as `assetRef` objects exactly as `@icb/contracts` defines them —
 * never as raw URLs — so any delivery still goes through the media store's signed links.
 * The upload flow that adds them belongs to the documents module; this schema only owns the
 * shape and the count the transaction detail exposes.
 */
@Schema({ collection: 'transaction_annotations', timestamps: true, versionKey: false })
export class TransactionAnnotationDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  @Prop({ type: String, required: true, index: true })
  transactionId!: string;

  @Prop({ type: String, default: null, maxlength: 500 })
  note!: string | null;

  @Prop({ type: [String], default: [] })
  tags!: string[];

  /** User category override. Null means the categoriser's verdict stands. */
  @Prop({ type: String, default: null })
  category!: string | null;

  /** `assetRef` shapes (provider/publicId/resourceType/uploadedAt, …). Count-only today. */
  @Prop({ type: [Object], default: [] })
  attachments!: Record<string, unknown>[];
}

export type TransactionAnnotationDocument = HydratedDocument<TransactionAnnotationDoc>;
export const TransactionAnnotationSchema = SchemaFactory.createForClass(TransactionAnnotationDoc);
TransactionAnnotationSchema.index({ customerId: 1, transactionId: 1 }, { unique: true });
