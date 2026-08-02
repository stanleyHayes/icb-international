import type { CustomerTier } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { spreadBpsForTier } from '../domain/fx-spread.js';

/**
 * Reads the one customer attribute FX cares about.
 *
 * A whole customer document is not needed to price a conversion, and pulling one would couple FX
 * to every future change in the profile shape. A missing or unknown tier falls back to the
 * standard spread, so a data problem costs the customer nothing and the bank nothing either.
 */
@Injectable()
export class CustomerTierReader {
  constructor(@InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>) {}

  async tierFor(customerId: string): Promise<string | null> {
    const customer = await this.customers.findById(customerId).select({ tier: 1 }).lean();
    return customer?.tier ?? null;
  }

  /** The spread the customer actually deals at, in basis points. */
  async spreadBpsFor(customerId: string): Promise<number> {
    return spreadBpsForTier(await this.tierFor(customerId));
  }

  /** Narrowed tier for display, defaulting to `standard` when absent. */
  static asTier(value: string | null): CustomerTier {
    const tiers: readonly CustomerTier[] = ['standard', 'plus', 'premier', 'private'];
    return tiers.find((tier) => tier === value) ?? 'standard';
  }
}
