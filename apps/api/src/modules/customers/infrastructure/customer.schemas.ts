import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * Identity is split in two on purpose.
 *
 * `customers` holds who someone is; `user_credentials` holds how they prove it. Keeping login
 * material in its own collection means a query that renders a profile cannot accidentally return
 * a password hash, and credentials can be locked down independently of profile data.
 */

@Schema({ _id: false })
export class AddressSub {
  @Prop({ type: String, required: true }) line1!: string;
  @Prop({ type: String, default: null }) line2!: string | null;
  @Prop({ type: String, required: true }) city!: string;
  @Prop({ type: String, default: null }) region!: string | null;
  @Prop({ type: String, default: null }) postalCode!: string | null;
  @Prop({ type: String, required: true }) country!: string;
}
export const AddressSubSchema = SchemaFactory.createForClass(AddressSub);

@Schema({ collection: 'customers', timestamps: true, versionKey: false })
export class CustomerDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, enum: ['individual', 'business'] })
  type!: string;

  @Prop({ type: String, required: true, index: true })
  status!: string;

  @Prop({ type: String, required: true, default: 'standard', index: true })
  tier!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  email!: string;

  @Prop({ type: String, required: true })
  phone!: string;

  @Prop({ type: Object, default: null })
  individual!: Record<string, unknown> | null;

  @Prop({ type: Object, default: null })
  business!: Record<string, unknown> | null;

  @Prop({ type: AddressSubSchema, default: null })
  residentialAddress!: AddressSub | null;

  @Prop({ type: AddressSubSchema, default: null })
  postalAddress!: AddressSub | null;

  @Prop({ type: Object, default: null })
  avatar!: Record<string, unknown> | null;

  @Prop({ type: Object, required: true })
  preferences!: Record<string, unknown>;

  @Prop({ type: String, default: null })
  kycLevel!: string | null;

  @Prop({ type: String, required: true, default: 'not_started', index: true })
  kycStatus!: string;

  @Prop({ type: Date, default: null })
  kycVerifiedAt!: Date | null;

  @Prop({ type: Date, default: null })
  kycNextReviewAt!: Date | null;

  @Prop({ type: String, required: true, default: 'low', index: true })
  riskRating!: string;

  @Prop({ type: [Object], default: [] })
  flags!: Record<string, unknown>[];

  @Prop({ type: String, default: null })
  relationshipManager!: string | null;

  @Prop({ type: Date, required: true })
  memberSince!: Date;

  @Prop({ type: Date, default: null })
  lastActivityAt!: Date | null;
}

export type CustomerDocument = HydratedDocument<CustomerDoc>;
export const CustomerSchema = SchemaFactory.createForClass(CustomerDoc);
CustomerSchema.index({ status: 1, tier: 1 });
CustomerSchema.index(
  { email: 'text', phone: 'text', 'individual.firstName': 'text', 'individual.lastName': 'text' },
  { name: 'customer_search' },
);

@Schema({ collection: 'user_credentials', timestamps: true, versionKey: false })
export class UserCredentialDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, default: null, index: true })
  customerId!: string | null;

  @Prop({ type: String, required: true, unique: true, index: true })
  email!: string;

  @Prop({ type: String, required: true })
  passwordHash!: string;

  @Prop({ type: Boolean, required: true, default: false })
  emailVerified!: boolean;

  @Prop({ type: String, default: null })
  emailVerificationTokenHash!: string | null;

  @Prop({ type: Date, default: null })
  emailVerificationExpiresAt!: Date | null;

  @Prop({ type: String, default: null })
  passwordResetTokenHash!: string | null;

  @Prop({ type: Date, default: null })
  passwordResetExpiresAt!: Date | null;

  @Prop({ type: Boolean, required: true, default: false })
  mfaEnabled!: boolean;

  /** Encrypted at rest — never returned by any query that reaches a controller. */
  @Prop({ type: String, default: null })
  mfaSecretEncrypted!: string | null;

  @Prop({ type: [String], default: [] })
  recoveryCodeHashes!: string[];

  @Prop({ type: Number, required: true, default: 0 })
  failedAttempts!: number;

  @Prop({ type: Date, default: null })
  lockedUntil!: Date | null;

  @Prop({ type: Date, default: null })
  lastLoginAt!: Date | null;

  @Prop({ type: [String], required: true, default: [] })
  roles!: string[];

  @Prop({ type: Boolean, required: true, default: true })
  active!: boolean;
}

export type UserCredentialDocument = HydratedDocument<UserCredentialDoc>;
export const UserCredentialSchema = SchemaFactory.createForClass(UserCredentialDoc);

@Schema({ collection: 'sessions', timestamps: true, versionKey: false })
export class SessionDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  userId!: string;

  /**
   * All refresh tokens descended from one login share a family id. Presenting an already-rotated
   * token means it was stolen, so the whole family is revoked rather than just that token.
   */
  @Prop({ type: String, required: true, index: true })
  familyId!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  tokenHash!: string;

  @Prop({ type: Object, required: true })
  device!: Record<string, unknown>;

  @Prop({ type: String, required: true })
  ipAddress!: string;

  @Prop({ type: String, default: null })
  location!: string | null;

  @Prop({ type: Boolean, required: true, default: false })
  trusted!: boolean;

  @Prop({ type: Date, required: true })
  lastSeenAt!: Date;

  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;

  @Prop({ type: String, default: null })
  revokedReason!: string | null;
}

export type SessionDocument = HydratedDocument<SessionDoc>;
export const SessionSchema = SchemaFactory.createForClass(SessionDoc);
SessionSchema.index({ userId: 1, revokedAt: 1 });
