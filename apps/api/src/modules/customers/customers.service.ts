import type { CustomerProfile, CustomerType, UpdateProfileRequest } from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../common/errors/index.js';
import { redactPii } from '../../common/interceptors/redact.js';
import { CustomerClosedError } from './domain/customer-errors.js';
import { buildPreferencesPatch, buildProfilePatch } from './domain/profile-patch.js';
import { toCustomerProfile } from './infrastructure/customer.mapper.js';
import { CustomerDoc } from './infrastructure/customer.schemas.js';
import type { UpdatePreferencesRequest } from './customers.types.js';

/**
 * The customer's own view of themselves: profile reads and self-service edits.
 *
 * Every method derives the customer from the verified token (the controller passes a
 * `customerId` claim, never a path parameter), so there is no way to ask about anyone else.
 * Log lines pass through `redactPii` — a profile payload in a log file is a breach, not
 * debugging information.
 */
@Injectable()
export class CustomersService {
  private readonly logger = new Logger(CustomersService.name);

  constructor(
    @InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>,
  ) {}

  async me(customerId: string): Promise<CustomerProfile> {
    return toCustomerProfile(await this.require(customerId));
  }

  async updateProfile(customerId: string, request: UpdateProfileRequest): Promise<CustomerProfile> {
    const customer = await this.require(customerId);
    assertEditable(customer);

    const patch = buildProfilePatch(request, customer.type as CustomerType);
    return this.applyPatch(customerId, patch, customer);
  }

  async updatePreferences(
    customerId: string,
    request: UpdatePreferencesRequest,
  ): Promise<CustomerProfile> {
    const customer = await this.require(customerId);
    assertEditable(customer);

    const patch = buildPreferencesPatch(request);
    return this.applyPatch(customerId, patch, customer);
  }

  /** Shared existence check for this module's other services (notes, lifecycle, export). */
  async require(customerId: string): Promise<CustomerDoc> {
    const customer = await this.customers.findById(customerId).lean();
    if (!customer) {
      throw new NotFoundError('Customer', customerId);
    }
    return customer;
  }

  /** An empty patch is a no-op read; a real one is written and the fresh document returned. */
  private async applyPatch(
    customerId: string,
    patch: Record<string, unknown>,
    current: CustomerDoc,
  ): Promise<CustomerProfile> {
    if (Object.keys(patch).length === 0) {
      return toCustomerProfile(current);
    }

    const updated = await this.customers
      .findOneAndUpdate({ _id: customerId }, { $set: patch }, { new: true })
      .lean();
    if (!updated) {
      throw new NotFoundError('Customer', customerId);
    }

    this.logger.log(
      redactPii({ customerId, fields: Object.keys(patch) }),
      'Customer profile updated',
    );
    return toCustomerProfile(updated);
  }
}

function assertEditable(customer: CustomerDoc): void {
  if (customer.status === 'closed') {
    throw new CustomerClosedError(customer._id);
  }
}
