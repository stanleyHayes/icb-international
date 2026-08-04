import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * The AML alert store — screening hits and monitoring detections awaiting a human.
 *
 * Two deliberate shapes here:
 *
 *  - `trail` is embedded, not a separate collection. The audit trail of a case *is* the case;
 *    an entry written anywhere else could be lost, reordered, or edited without the case
 *    noticing, and an AML audit trail you cannot trust is worse than none.
 *  - `filedReport.draft` stays in the document even though the API never returns it. A filed
 *    report is a regulatory artefact: the exact words that went out must be reconstructible
 *    years later, so they are stored, not regenerated.
 */

@Schema({ _id: false })
export class TrailEntrySub {
  @Prop({ type: Date, required: true }) at!: Date;
  @Prop({ type: String, required: true }) by!: string;
  @Prop({ type: String, required: true }) action!: string;
  @Prop({ type: String, required: true }) detail!: string;
}
export const TrailEntrySubSchema = SchemaFactory.createForClass(TrailEntrySub);

@Schema({ _id: false })
export class FiledReportSub {
  @Prop({ type: String, required: true }) kind!: string;
  @Prop({ type: String, required: true }) reference!: string;
  @Prop({ type: Date, required: true }) filedAt!: Date;
  /** The full regulatory draft as filed. Internal only — never serialised to the API. */
  @Prop({ type: String, required: true }) draft!: string;
}
export const FiledReportSubSchema = SchemaFactory.createForClass(FiledReportSub);

@Schema({ collection: 'aml_alerts', timestamps: true, versionKey: false })
export class AmlAlertDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  reference!: string;

  @Prop({ type: String, required: true, index: true })
  kind!: string;

  @Prop({ type: String, required: true, index: true })
  customerId!: string;

  /** Denormalised so the queue renders without a lookup per row. */
  @Prop({ type: String, required: true })
  customerName!: string;

  @Prop({ type: String, required: true, index: true })
  severity!: string;

  @Prop({ type: String, required: true, index: true })
  status!: string;

  @Prop({ type: String, required: true })
  matchDetail!: string;

  @Prop({ type: Number, default: null })
  matchScore!: number | null;

  // `default` without `required`: Mongoose's array required-validator rejects an empty
  // array, so `required: true, default: []` can never be satisfied by its own default —
  // and empty is the ordinary case here. It survives today only where the write goes
  // through updateOne, which skips validators; a create() on this path would 500.
  @Prop({ type: [String], default: [] })
  relatedTransactionIds!: string[];

  @Prop({ type: Number, default: null })
  aggregateMinorUnits!: number | null;

  @Prop({ type: String, default: null })
  currency!: string | null;

  @Prop({ type: String, default: null })
  narrative!: string | null;

  @Prop({ type: String, default: null, index: true })
  assignedTo!: string | null;

  @Prop({ type: FiledReportSubSchema, default: null })
  filedReport!: FiledReportSub | null;

  @Prop({ type: [TrailEntrySubSchema], default: [] })
  trail!: TrailEntrySub[];

  @Prop({ type: Date, required: true, index: true })
  createdAt!: Date;

  @Prop({ type: Date, required: true })
  updatedAt!: Date;
}

export type AmlAlertDocument = HydratedDocument<AmlAlertDoc>;
export const AmlAlertSchema = SchemaFactory.createForClass(AmlAlertDoc);
AmlAlertSchema.index({ status: 1, severity: 1, createdAt: -1 });
AmlAlertSchema.index({ customerId: 1, kind: 1, status: 1 });
