import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';

/**
 * Content persistence (agent_plan.md ADM-15).
 *
 * As everywhere else in the API, timestamps are written by the services from the simulation
 * clock rather than by Mongoose `timestamps`, so time travel moves them too (N8).
 */

@Schema({ collection: 'content_articles', versionKey: false })
export class ContentArticleDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true })
  title!: string;

  /** URL-safe, unique across articles — the help centre links by slug. */
  @Prop({ type: String, required: true, unique: true })
  slug!: string;

  @Prop({ type: String, required: true, index: true })
  category!: string;

  /** Markdown body, rendered by the consumer. */
  @Prop({ type: String, required: true })
  body!: string;

  @Prop({ type: Boolean, required: true, default: false, index: true })
  published!: boolean;

  @Prop({ type: Number, required: true, default: 100 })
  ordering!: number;

  @Prop({ type: String, required: true })
  createdBy!: string;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: Date, required: true })
  updatedAt!: Date;
}
export type ContentArticleDocument = HydratedDocument<ContentArticleDoc>;
export const ContentArticleSchema = SchemaFactory.createForClass(ContentArticleDoc);
ContentArticleSchema.index({ category: 1, ordering: 1, title: 1 });

@Schema({ _id: false })
export class LocationAddressSub {
  @Prop({ type: String, required: true }) line1!: string;
  @Prop({ type: String, default: null }) line2!: string | null;
  @Prop({ type: String, required: true }) city!: string;
  @Prop({ type: String, default: null }) region!: string | null;
  @Prop({ type: String, default: null }) postalCode!: string | null;
  @Prop({ type: String, required: true }) country!: string;
}
export const LocationAddressSubSchema = SchemaFactory.createForClass(LocationAddressSub);

@Schema({ collection: 'content_locations', versionKey: false })
export class ContentLocationDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: String, required: true, enum: ['branch', 'atm'], index: true })
  type!: string;

  @Prop({ type: LocationAddressSubSchema, required: true })
  address!: LocationAddressSub;

  /** Decimal degrees; null when nobody has geocoded the site yet. */
  @Prop({ type: Number, default: null })
  latitude!: number | null;

  @Prop({ type: Number, default: null })
  longitude!: number | null;

  /**
   * Free-text hours ("Mon–Fri 08:30–16:00") — branches keep irregular hours.
   *
   * `default` without `required`: Mongoose's String required-validator rejects the empty string,
   * so `required: true, default: ''` can never be satisfied by its own default. An ATM with no
   * published hours is ordinary, and the contract defaults this to '' — the default supplies the
   * value, and there is nothing left for `required` to protect.
   */
  @Prop({ type: String, default: '' })
  hours!: string;

  @Prop({ type: [String], default: [] })
  services!: string[];

  @Prop({ type: Boolean, required: true, default: true, index: true })
  active!: boolean;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: Date, required: true })
  updatedAt!: Date;
}
export type ContentLocationDocument = HydratedDocument<ContentLocationDoc>;
export const ContentLocationSchema = SchemaFactory.createForClass(ContentLocationDoc);
ContentLocationSchema.index({ type: 1, name: 1 });

@Schema({ collection: 'content_template_overrides', versionKey: false })
export class ContentTemplateOverrideDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  /** Notification event key the override applies to, e.g. `transfer_sent`. */
  @Prop({ type: String, required: true })
  key!: string;

  @Prop({ type: String, required: true, enum: ['in_app', 'email', 'sms', 'push'] })
  channel!: string;

  /** Empty for channels that carry no subject line (SMS, push) — see the note on `hours`. */
  @Prop({ type: String, default: '' })
  subject!: string;

  @Prop({ type: String, required: true })
  body!: string;

  @Prop({ type: String, required: true })
  updatedBy!: string;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: Date, required: true })
  updatedAt!: Date;
}
export type ContentTemplateOverrideDocument = HydratedDocument<ContentTemplateOverrideDoc>;
export const ContentTemplateOverrideSchema = SchemaFactory.createForClass(
  ContentTemplateOverrideDoc,
);
/** One override per (key, channel) — upsert target. */
ContentTemplateOverrideSchema.index({ key: 1, channel: 1 }, { unique: true });

@Schema({ collection: 'content_rate_entries', versionKey: false })
export class ContentRateEntryDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  /** Product code the entry overrides or extends; one entry per code. */
  @Prop({ type: String, required: true, unique: true })
  productCode!: string;

  @Prop({ type: String, required: true })
  name!: string;

  @Prop({ type: Number, required: true })
  rate!: number;

  @Prop({ type: Date, required: true })
  effectiveFrom!: Date;

  @Prop({ type: String, required: true })
  createdBy!: string;

  @Prop({ type: Date, required: true })
  createdAt!: Date;

  @Prop({ type: Date, required: true })
  updatedAt!: Date;
}
export type ContentRateEntryDocument = HydratedDocument<ContentRateEntryDoc>;
export const ContentRateEntrySchema = SchemaFactory.createForClass(ContentRateEntryDoc);
