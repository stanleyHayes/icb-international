import { ACCOUNT_KINDS, KYC_LEVELS } from '@icb/contracts';
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import type { HydratedDocument } from 'mongoose';

import { newId } from '../../../infrastructure/database/identifier.js';
import type { EligibilityRules } from '../domain/eligibility.js';
import type { FeeDefinition } from '../domain/fee-calculation.js';
import type { ProductLimitRow } from '../domain/limit-matrix.js';
import type { RateChange } from '../domain/rate-schedule.js';

/** Persisted fee line: the domain definition plus the customer-facing label. */
export interface FeeRow extends FeeDefinition {
  readonly label: string;
}

export interface InterestBandRow {
  readonly fromMinorUnits: number;
  readonly rate: number;
}

export interface DepositTermRow {
  readonly termMonths: number;
  readonly rate: number;
  readonly minimumMinorUnits: number;
}

export interface LoanRateRangeRow {
  readonly fromRate: number;
  readonly toRate: number;
}

const REQUIRED_NUMBER = { type: Number, required: true } as const;
const NULLABLE_NUMBER = { type: Number, default: null } as const;
const REQUIRED_STRING = { type: String, required: true } as const;

const FEE_TIER_PROP = {
  type: [{ fromMinorUnits: REQUIRED_NUMBER, percentage: REQUIRED_NUMBER }],
  default: [],
} as const;

const FEE_PROP = {
  type: [
    {
      code: REQUIRED_STRING,
      label: REQUIRED_STRING,
      basis: { type: String, required: true, enum: ['flat', 'percentage', 'tiered'] },
      amountMinorUnits: NULLABLE_NUMBER,
      percentage: NULLABLE_NUMBER,
      tiers: FEE_TIER_PROP,
      minimumMinorUnits: NULLABLE_NUMBER,
      maximumMinorUnits: NULLABLE_NUMBER,
      waivedForTiers: { type: [String], default: [] },
    },
  ],
  default: [],
} as const;

/**
 * A product in the catalogue.
 *
 * Money is stored as integer minor units only (N3); the currency is the product's primary
 * currency (`currencies[0]`), applied at the mapping boundary. The document carries more than
 * the wire contract — fee tier rows, the limit matrix, the rate schedule, deposit terms and
 * loan rate ranges are internal pricing detail that `product.mapper.ts` strips.
 */
@Schema({ collection: 'products', timestamps: true, versionKey: false })
export class ProductDoc {
  @Prop({ type: String, default: newId })
  _id!: string;

  @Prop({ type: String, required: true })
  code!: string;

  @Prop(REQUIRED_STRING)
  name!: string;

  @Prop(REQUIRED_STRING)
  tagline!: string;

  @Prop(REQUIRED_STRING)
  description!: string;

  @Prop({ type: String, required: true, enum: ACCOUNT_KINDS })
  kind!: string;

  @Prop({ type: [String], required: true })
  currencies!: string[];

  /** Base rate, used when no schedule entry has taken effect. Null means non-interest-bearing. */
  @Prop(NULLABLE_NUMBER)
  interestRate!: number | null;

  @Prop({ type: [{ fromMinorUnits: REQUIRED_NUMBER, rate: REQUIRED_NUMBER }], default: null })
  interestBands!: InterestBandRow[] | null;

  @Prop({ type: [{ effectiveFrom: { type: Date, required: true }, rate: REQUIRED_NUMBER }], default: [] })
  rateSchedule!: RateChange[];

  @Prop(NULLABLE_NUMBER)
  minimumOpeningBalanceMinorUnits!: number | null;

  @Prop(NULLABLE_NUMBER)
  minimumBalanceMinorUnits!: number | null;

  @Prop(NULLABLE_NUMBER)
  monthlyFeeMinorUnits!: number | null;

  @Prop(FEE_PROP)
  fees!: FeeRow[];

  @Prop({ type: [String], default: [] })
  features!: string[];

  @Prop({
    type: {
      minimumAge: NULLABLE_NUMBER,
      minimumKycLevel: { type: String, default: null, enum: [...KYC_LEVELS, null] },
      residentsOnly: { type: Boolean, required: true },
      businessOnly: { type: Boolean, required: true },
    },
    required: true,
  })
  eligibility!: EligibilityRules;

  @Prop({
    type: [
      {
        kycLevel: { type: String, required: true, enum: KYC_LEVELS },
        singleTransactionMinorUnits: NULLABLE_NUMBER,
        dailyMinorUnits: NULLABLE_NUMBER,
        monthlyMinorUnits: NULLABLE_NUMBER,
        maxBalanceMinorUnits: NULLABLE_NUMBER,
        overdraftMinorUnits: { type: Number, required: true, default: 0 },
      },
    ],
    default: [],
  })
  limits!: ProductLimitRow[];

  /** Fixed-deposit kind only: the published term sheet. */
  @Prop({
    type: [{ termMonths: REQUIRED_NUMBER, rate: REQUIRED_NUMBER, minimumMinorUnits: REQUIRED_NUMBER }],
    default: [],
  })
  depositTerms!: DepositTermRow[];

  /** Loan kind only: the advertised "from–to" APR band. */
  @Prop({ type: { fromRate: REQUIRED_NUMBER, toRate: REQUIRED_NUMBER }, default: null })
  loanRateRange!: LoanRateRangeRow | null;

  @Prop({ type: Boolean, required: true, default: true, index: true })
  active!: boolean;

  @Prop({ type: Number, required: true, default: 0 })
  displayOrder!: number;

  @Prop({ type: Number, required: true, default: 1 })
  version!: number;
}

export type ProductDocument = HydratedDocument<ProductDoc>;
export const ProductSchema = SchemaFactory.createForClass(ProductDoc);

// The catalogue is keyed by code everywhere (accounts, loans, SDK paths) — enforced here, once.
ProductSchema.index({ code: 1 }, { unique: true });
ProductSchema.index({ active: 1, displayOrder: 1 });
