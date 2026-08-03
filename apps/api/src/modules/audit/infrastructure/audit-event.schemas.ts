import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';
import { ACTOR_TYPES, type AuditActorType, type AuditChange } from '../domain/audit-event.js';
import { AuditImmutableError } from '../domain/audit-errors.js';

/**
 * One link in the audit chain (agent_plan.md §5 `audit_events`, N7).
 *
 * No Mongoose `timestamps` on purpose: `at` is written from the simulated clock by the service,
 * not from wall time, so a time-travelled scenario produces a trail consistent with the events it
 * narrates. `sequence` and `hash` are both unique — the sequence gives the chain a total order,
 * the hash makes any edit to a stored row detectable.
 *
 * `before`/`after` are stored already PII-masked; they exist so the hash commits to the full
 * snapshots while the wire contract (`changes`) stays a summary.
 */
@Schema({ collection: 'audit_events', timestamps: false, versionKey: false })
export class AuditEventDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: Number, required: true })
  sequence!: number;

  @Prop({ type: String, required: true, enum: ACTOR_TYPES })
  actorType!: AuditActorType;

  @Prop({ type: String, default: null })
  actorId!: string | null;

  @Prop({ type: String, required: true })
  actorLabel!: string;

  @Prop({ type: String, required: true })
  action!: string;

  @Prop({ type: String, required: true })
  subjectType!: string;

  @Prop({ type: String, default: null })
  subjectId!: string | null;

  @Prop({ type: String, required: true })
  summary!: string;

  @Prop({ type: Object, default: null })
  before!: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  after!: Record<string, unknown> | null;

  @Prop({ type: [Object], default: [] })
  changes!: AuditChange[];

  @Prop({ type: String, default: null })
  ipAddress!: string | null;

  @Prop({ type: String, required: true })
  correlationId!: string;

  @Prop({ type: String, default: null })
  previousHash!: string | null;

  @Prop({ type: String, required: true })
  hash!: string;

  @Prop({ type: Date, required: true })
  at!: Date;
}

export type AuditEventDocument = HydratedDocument<AuditEventDoc>;
export const AuditEventSchema = SchemaFactory.createForClass(AuditEventDoc);

AuditEventSchema.index({ sequence: 1 }, { unique: true });
AuditEventSchema.index({ hash: 1 }, { unique: true });
AuditEventSchema.index({ subjectType: 1, subjectId: 1, sequence: -1 });
AuditEventSchema.index({ actorId: 1, at: -1 });
AuditEventSchema.index({ action: 1, sequence: -1 });

/**
 * Append-only, enforced at the schema so no future code path — a script, a migration, a hurried
 * `updateOne` — can rewrite history. The hook throws before Mongo is ever asked.
 */
const FORBIDDEN_OPERATIONS = [
  'updateOne',
  'updateMany',
  'replaceOne',
  'deleteOne',
  'deleteMany',
  'findOneAndUpdate',
  'findOneAndReplace',
  'findOneAndDelete',
  'findOneAndRemove',
  'remove',
] as const;

for (const operation of FORBIDDEN_OPERATIONS) {
  AuditEventSchema.pre(operation as 'updateOne', () => {
    throw new AuditImmutableError(operation);
  });
}
