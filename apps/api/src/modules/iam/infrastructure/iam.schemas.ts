import type { MoneyDto } from '@icb/contracts';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * Back-office identity.
 *
 * `staff_users` mirrors `customers` in shape but not in privilege: a row here is what the
 * role/permission guards read to decide what an operator may touch. Login material stays in
 * `user_credentials` (auth module); this collection is profile, roles and policy flags only.
 */
@Schema({ collection: 'staff_users', timestamps: true, versionKey: false })
export class StaffUserDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  email!: string;

  @Prop({ type: String, required: true })
  firstName!: string;

  @Prop({ type: String, required: true })
  lastName!: string;

  /** Values from `STAFF_ROLES` in @icb/contracts; validated at the application edge. */
  // `default` without `required`: Mongoose's array required-validator rejects an empty
  // array, so `required: true, default: []` can never be satisfied by its own default —
  // and empty is the ordinary case here. It survives today only where the write goes
  // through updateOne, which skips validators; a create() on this path would 500.
  @Prop({ type: [String], default: [] })
  roles!: string[];

  @Prop({ type: Boolean, required: true, default: true, index: true })
  active!: boolean;

  /** Policy flag: the account must enrol a second factor before it can operate. */
  @Prop({ type: Boolean, required: true, default: true })
  mfaRequired!: boolean;

  @Prop({ type: Boolean, required: true, default: false })
  mfaEnabled!: boolean;

  @Prop({ type: Date, default: null })
  lastLoginAt!: Date | null;

  createdAt!: Date;
  updatedAt!: Date;
}

export type StaffUserDocument = HydratedDocument<StaffUserDoc>;
export const StaffUserSchema = SchemaFactory.createForClass(StaffUserDoc);

/**
 * A generic four-eyes request.
 *
 * One shape backs every privileged action that needs a second pair of eyes — high-value
 * transfers, manual postings, limit changes, refunds, write-offs — so the inbox, the
 * self-approval rule and the expiry sweep are implemented exactly once. `kind` says what is
 * being approved; `subjectRef` points at the domain object; `payload` carries the arguments
 * the approving domain module will need to execute after approval.
 */
@Schema({ collection: 'approval_requests', timestamps: true, versionKey: false })
export class ApprovalRequestDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  kind!: string;

  @Prop({ type: String, required: true })
  summary!: string;

  /** Pointer to the thing being approved, e.g. `{ type: 'transfer', id: '01J…' }`. */
  @Prop({ type: Object, required: true })
  subjectRef!: { type: string; id: string };

  @Prop({ type: Object, required: true, default: {} })
  payload!: Record<string, unknown>;

  /** Money at stake, when the kind has an amount; null for purely configurational changes. */
  @Prop({ type: Object, default: null })
  amount!: MoneyDto | null;

  /** Staff id of the maker. The checker can never be the same person. */
  @Prop({ type: String, required: true, index: true })
  requestedBy!: string;

  @Prop({ type: Date, required: true })
  requestedAt!: Date;

  @Prop({ type: String, required: true, default: 'pending', index: true })
  status!: string;

  @Prop({ type: String, default: null })
  decidedBy!: string | null;

  @Prop({ type: Date, default: null })
  decidedAt!: Date | null;

  @Prop({ type: String, default: null })
  reason!: string | null;

  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;

  createdAt!: Date;
  updatedAt!: Date;
}

export type ApprovalRequestDocument = HydratedDocument<ApprovalRequestDoc>;
export const ApprovalRequestSchema = SchemaFactory.createForClass(ApprovalRequestDoc);
ApprovalRequestSchema.index({ status: 1, expiresAt: 1 });
ApprovalRequestSchema.index({ kind: 1, status: 1 });
