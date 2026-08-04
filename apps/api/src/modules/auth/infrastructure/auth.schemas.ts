import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * Auth-owned persistence.
 *
 * Three small collections, each append-mostly: challenges are consumed once, trusted devices
 * expire, and audit events are never touched again (N7). Identity documents themselves
 * (`user_credentials`, `sessions`, `customers`) belong to the customers module and are only
 * referenced here.
 */

@Schema({ collection: 'mfa_challenges', timestamps: true, versionKey: false })
export class MfaChallengeDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  userId!: string;

  /** How the code is proven: an authenticator code, or an SMS one-time passcode. */
  @Prop({ type: String, required: true, enum: ['totp', 'sms'] })
  method!: string;

  /** SHA-256 of the SMS code; null for TOTP, where the secret lives on the credential. */
  @Prop({ type: String, default: null })
  codeHash!: string | null;

  /** Set for step-up challenges: the sensitive operation this challenge authorises. */
  @Prop({ type: String, default: null })
  purpose!: string | null;

  /** Device the login attempt came from, so a trusted device can be registered on success. */
  @Prop({ type: String, default: null })
  deviceId!: string | null;

  @Prop({ type: String, required: true })
  userAgent!: string;

  @Prop({ type: String, required: true })
  ipAddress!: string;

  @Prop({ type: Number, required: true, default: 0 })
  attempts!: number;

  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  consumedAt!: Date | null;
}
export type MfaChallengeDocument = HydratedDocument<MfaChallengeDoc>;
export const MfaChallengeSchema = SchemaFactory.createForClass(MfaChallengeDoc);

@Schema({ collection: 'trusted_devices', timestamps: false, versionKey: false })
export class TrustedDeviceDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, index: true })
  userId!: string;

  /** Opaque, client-generated, stable per browser — matches `LoginRequest.deviceId`. */
  @Prop({ type: String, required: true })
  deviceId!: string;

  @Prop({ type: String, required: true })
  label!: string;

  @Prop({ type: Date, required: true })
  trustedAt!: Date;

  @Prop({ type: Date, required: true })
  lastSeenAt!: Date;

  @Prop({ type: Date, required: true, index: true })
  expiresAt!: Date;

  @Prop({ type: Date, default: null })
  revokedAt!: Date | null;
}
export type TrustedDeviceDocument = HydratedDocument<TrustedDeviceDoc>;
export const TrustedDeviceSchema = SchemaFactory.createForClass(TrustedDeviceDoc);
TrustedDeviceSchema.index({ userId: 1, deviceId: 1 });

/**
 * Authentication and security events: sign-ins, MFA challenges, credential changes.
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
