import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';

/**
 * Where a message is actually sent, and who it greets.
 *
 * Notifications deliberately do not depend on `CustomersService` — a module whose job is to send
 * mail should not be able to change a customer record. It reads the two fields it needs and
 * nothing else, which also keeps this module loadable on its own.
 */
export interface CustomerContact {
  readonly customerId: string;
  readonly email: string | null;
  readonly phone: string | null;
  /** First name for an individual, trading name for a business, null when neither is recorded. */
  readonly displayName: string | null;
}

@Injectable()
export class CustomerContactReader {
  constructor(
    @InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>,
  ) {}

  async forCustomer(customerId: string): Promise<CustomerContact | null> {
    const row = await this.customers
      .findById(customerId)
      .select('email phone individual business')
      .lean();

    if (!row) {
      return null;
    }

    return {
      customerId,
      email: nonEmpty(row.email),
      phone: nonEmpty(row.phone),
      displayName:
        readString(row.individual, 'firstName') ?? readString(row.business, 'tradingName'),
    };
  }
}

function nonEmpty(value: string | undefined): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** The profile sub-documents are stored loosely, so every read out of them is guarded. */
function readString(source: Record<string, unknown> | null, key: string): string | null {
  const value = source?.[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
