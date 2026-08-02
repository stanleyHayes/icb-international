import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../../common/errors/index.js';
import { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';

const ISO_DATE_LENGTH = 10;

/** The two facts a letterhead needs about the person it is addressed to. */
export interface CustomerProfile {
  displayName: string;
  /** ISO date the relationship started; printed on a banker's reference. */
  memberSince: string;
}

/**
 * A read-only view of `customers`, scoped to what a document needs.
 *
 * The documents module does not own customer identity, so it reads the two fields it prints and
 * nothing else — a query that returned the whole profile would put addresses and KYC state on a
 * code path that has no business seeing them.
 */
@Injectable()
export class CustomerProfileReader {
  constructor(@InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>) {}

  async require(customerId: string): Promise<CustomerProfile> {
    const customer = await this.customers
      .findById(customerId)
      .select('individual business email memberSince')
      .lean();

    if (!customer) {
      throw new NotFoundError('Customer', customerId);
    }

    return {
      displayName: displayNameOf(customer),
      memberSince: customer.memberSince.toISOString().slice(0, ISO_DATE_LENGTH),
    };
  }
}

/** `individual` and `business` are stored as open objects; narrow before reading. */
function readString(source: Record<string, unknown> | null, key: string): string {
  const value = source?.[key];
  return typeof value === 'string' ? value.trim() : '';
}

function displayNameOf(customer: CustomerDoc): string {
  const legalName = readString(customer.business, 'legalName');
  if (legalName.length > 0) {
    return legalName;
  }

  const personal = [
    readString(customer.individual, 'firstName'),
    readString(customer.individual, 'lastName'),
  ]
    .filter((part) => part.length > 0)
    .join(' ');

  return personal.length > 0 ? personal : customer.email;
}
