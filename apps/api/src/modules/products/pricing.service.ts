import type { KycLevel } from '@icb/contracts';
import type { Money } from '@icb/money';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../common/errors/index.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { evaluateEligibility, type CustomerFacts, type EligibilityResult } from './domain/eligibility.js';
import { calculateFee } from './domain/fee-calculation.js';
import { resolveLimits, type ProductLimitRow } from './domain/limit-matrix.js';
import { FeeNotFoundError, NoEffectiveRateError } from './domain/product-errors.js';
import { insertRateChange, resolveRateAt, type RateChange } from './domain/rate-schedule.js';
import { ProductDoc } from './infrastructure/product.schemas.js';
import { ProductsService } from './products.service.js';
import { RatesService } from './rates.service.js';

/**
 * Pricing: rates, fees, eligibility, and limits for a product.
 *
 * This is the read API other modules integrate with — the interest engine (BE-18) resolves
 * rates and quotes fees here, onboarding (BE-10) checks eligibility and limits here — so the
 * rules engine has exactly one implementation, in `domain/`, and every caller prices the same
 * way.
 */
@Injectable()
export class PricingService {
  constructor(
    @InjectModel(ProductDoc.name) private readonly products: Model<ProductDoc>,
    private readonly catalogue: ProductsService,
    private readonly rates: RatesService,
    private readonly clock: ClockService,
  ) {}

  /** The rate in force at `at` (default: now) — schedule first, base rate as fallback. */
  async resolveRate(productCode: string, at?: Date): Promise<number> {
    const doc = await this.catalogue.documentFor(productCode);
    const instant = at ?? this.clock.now();
    const rate = resolveRateAt(doc.rateSchedule, instant)?.rate ?? doc.interestRate;
    if (rate === null) {
      throw new NoEffectiveRateError(productCode, instant.toISOString());
    }
    return rate;
  }

  /** Announce a rate change. Takes effect at `change.effectiveFrom`, which may be future. */
  async addRateChange(productCode: string, change: RateChange): Promise<RateChange[]> {
    const doc = await this.catalogue.documentFor(productCode);
    const schedule = insertRateChange(doc.rateSchedule, change);
    const updated = await this.products
      .findOneAndUpdate({ code: productCode }, { $set: { rateSchedule: schedule }, $inc: { version: 1 } }, { new: true })
      .lean();
    if (!updated) {
      throw new NotFoundError('Product', productCode);
    }
    await this.rates.invalidate();
    return updated.rateSchedule;
  }

  /** The product's full effective-dated schedule, past and announced changes alike. */
  async rateScheduleFor(productCode: string): Promise<RateChange[]> {
    const doc = await this.catalogue.documentFor(productCode);
    return doc.rateSchedule;
  }

  /** The fee a customer at `customerTier` would pay on `subject`, after waivers and caps. */
  async quoteFee(
    productCode: string,
    feeCode: string,
    subject: Money,
    customerTier: string,
  ): Promise<Money> {
    const doc = await this.catalogue.documentFor(productCode);
    const fee = doc.fees.find((row) => row.code === feeCode);
    if (!fee) {
      throw new FeeNotFoundError(productCode, feeCode);
    }
    return calculateFee(fee, subject, customerTier);
  }

  /** Whether a customer with these facts may open this product, and if not, why not. */
  async checkEligibility(productCode: string, facts: CustomerFacts): Promise<EligibilityResult> {
    const doc = await this.catalogue.documentFor(productCode);
    return evaluateEligibility(doc.eligibility, facts);
  }

  /** The product's limits for a KYC level — the ceiling *under* the customer's tier ceiling. */
  async limitsFor(productCode: string, kycLevel: KycLevel | null): Promise<ProductLimitRow | null> {
    const doc = await this.catalogue.documentFor(productCode);
    return resolveLimits(doc.limits, kycLevel);
  }
}
