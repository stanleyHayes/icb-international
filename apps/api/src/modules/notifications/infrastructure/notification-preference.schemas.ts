import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * One preference document per customer.
 *
 * Only events the customer has actually changed are stored. Defaults live in code, so improving
 * them reaches everyone who never opened the screen — which is almost everyone — instead of
 * being frozen into rows written the day they registered.
 */

@Schema({ _id: false })
export class PreferenceEntry {
  @Prop({ type: String, required: true })
  event!: string;

  @Prop({ type: Boolean, required: true })
  inApp!: boolean;

  @Prop({ type: Boolean, required: true })
  email!: boolean;

  @Prop({ type: Boolean, required: true })
  sms!: boolean;

  @Prop({ type: Boolean, required: true })
  push!: boolean;
}

export const PreferenceEntrySchema = SchemaFactory.createForClass(PreferenceEntry);

@Schema({ collection: 'notification_preferences', timestamps: true, versionKey: false })
export class NotificationPreferenceDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true, unique: true, index: true })
  customerId!: string;

  @Prop({ type: [PreferenceEntrySchema], default: [] })
  entries!: PreferenceEntry[];

  @Prop({ type: Boolean, required: true, default: false })
  quietHoursEnabled!: boolean;

  /** Local `HH:mm` in the bank's business timezone, not UTC. */
  @Prop({ type: String, required: true, default: '22:00' })
  quietHoursFrom!: string;

  @Prop({ type: String, required: true, default: '07:00' })
  quietHoursTo!: string;

  @Prop({ type: Date, required: true })
  updatedAtUtc!: Date;
}

export type NotificationPreferenceDocument = HydratedDocument<NotificationPreferenceDoc>;
export const NotificationPreferenceSchema =
  SchemaFactory.createForClass(NotificationPreferenceDoc);
