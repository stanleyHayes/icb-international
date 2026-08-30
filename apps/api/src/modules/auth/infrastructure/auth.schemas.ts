import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * Auth-owned persistence.
 *
 * Audit events are append-mostly and never touched again once written (N7). Identity documents
 * themselves (`user_credentials`, `sessions`, `customers`) belong to the customers module and
 * are only referenced here.
 */

/**
 * Authentication and security events: sign-ins and credential changes.
 *
 * Append-only and hash-chained (N7) — every row points at the hash of the row before it, so a
 * tampered or deleted event breaks the chain and is detectable on verification.
 *
 * Distinct from the governance trail in `modules/audit`, which chains *changes to bank records*
 * (before/after, sequence, subject) rather than authentication attempts. The two were once both
 * called `AuditEventDoc` over the same `audit_events` collection; because Mongoose keys its model
 * registry by class name, only the first module to register won and every write from the other
 * failed validation — silently, because the audit interceptor swallows append failures. Separate
 * names and separate collections are what keep both trails real.
 */
@Schema({ collection: 'security_events', timestamps: false, versionKey: false })
export class SecurityEventDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  /** The principal the event is about; null when there is none yet (a failed login, say). */
  @Prop({ type: String, default: null, index: true })
  actorId!: string | null;

  @Prop({ type: String, required: true, index: true })
  action!: string;

  @Prop({ type: String, required: true, enum: ['success', 'failure'] })
  outcome!: string;

  /** Never carries secrets — no tokens, codes, hashes, or passwords, only identifiers. */
  @Prop({ type: Object, required: true, default: {} })
  context!: Record<string, unknown>;

  @Prop({ type: String, default: null })
  ipAddress!: string | null;

  @Prop({ type: String, default: null })
  userAgent!: string | null;

  @Prop({ type: String, default: null })
  previousHash!: string | null;

  @Prop({ type: String, required: true })
  hash!: string;

  @Prop({ type: Date, required: true, index: true })
  occurredAt!: Date;
}
export type SecurityEventDocument = HydratedDocument<SecurityEventDoc>;
export const SecurityEventSchema = SchemaFactory.createForClass(SecurityEventDoc);
