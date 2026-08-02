import type { CustomerAdminView, CustomerSearchQuery, OffsetPage } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../common/errors/index.js';
import { toMoneyDto } from '../accounts/infrastructure/account.mapper.js';
import { AccountDoc } from '../accounts/infrastructure/account.schemas.js';
import { CustomerDoc } from '../customers/infrastructure/customer.schemas.js';
import { customerRef } from '../ledger/domain/account-ref.js';
import { AccountBalanceDoc } from '../ledger/infrastructure/ledger.schemas.js';

const BASE_CURRENCY = 'USD';

/**
 * Customer search and the 360° view, for the back office.
 *
 * Search is deliberately broad — staff are given an email, a phone number, or a fragment of an
 * account number by a caller and must find the right person from whichever of those they have.
 * User input reaches a regex, so it is escaped before it gets there.
 */
@Injectable()
export class CustomerDirectoryService {
  constructor(
    @InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>,
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    @InjectModel(AccountBalanceDoc.name) private readonly balances: Model<AccountBalanceDoc>,
  ) {}

  async search(
    query: CustomerSearchQuery & { page: number; limit: number },
  ): Promise<OffsetPage<CustomerAdminView>> {
    const filter = await this.buildFilter(query);
    const skip = (query.page - 1) * query.limit;

    const [rows, total] = await Promise.all([
      this.customers.find(filter).sort({ createdAt: -1 }).skip(skip).limit(query.limit).lean(),
      this.customers.countDocuments(filter),
    ]);

    const views = await Promise.all(rows.map((row) => this.toAdminView(row)));

    return {
      items: views,
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  }

  async getById(customerId: string): Promise<CustomerAdminView> {
    const customer = await this.customers.findById(customerId).lean();
    if (!customer) {
      throw new NotFoundError('Customer', customerId);
    }
    return this.toAdminView(customer);
  }

  private async buildFilter(query: CustomerSearchQuery): Promise<Record<string, unknown>> {
    const filter: Record<string, unknown> = {};

    if (query.status) filter['status'] = query.status;
    if (query.tier) filter['tier'] = query.tier;
    if (query.riskRating) filter['riskRating'] = query.riskRating;
    if (query.kycStatus) filter['kycStatus'] = query.kycStatus;

    if (query.q) {
      const pattern = { $regex: escapeRegex(query.q), $options: 'i' };
      const matchedIds = await this.customerIdsByAccountNumber(query.q);

      filter['$or'] = [
        { email: pattern },
        { phone: pattern },
        { 'individual.firstName': pattern },
        { 'individual.lastName': pattern },
        { 'business.legalName': pattern },
        ...(matchedIds.length > 0 ? [{ _id: { $in: matchedIds } }] : []),
      ];
    }

    return filter;
  }

  /** A caller quoting an account number is far more common than one quoting a customer id. */
  private async customerIdsByAccountNumber(term: string): Promise<string[]> {
    if (!/^\d{3,10}$/.test(term)) {
      return [];
    }
    const accounts = await this.accounts
      .find({ number: { $regex: `${escapeRegex(term)}$` } })
      .select('customerId')
      .limit(25)
      .lean();
    return accounts.map((account) => account.customerId);
  }

  private async toAdminView(customer: CustomerDoc): Promise<CustomerAdminView> {
    const accounts = await this.accounts
      .find({ customerId: customer._id, status: { $ne: 'closed' } })
      .select('_id')
      .lean();

    const balances = await this.balances
      .find({
        accountRef: { $in: accounts.map((account) => customerRef(account._id)) },
        currency: BASE_CURRENCY,
      })
      .lean();

    const relationshipValue = balances.reduce((total, row) => total + row.ledgerMinorUnits, 0);
    return {
      id: customer._id,
      type: customer.type as CustomerAdminView['type'],
      status: customer.status as CustomerAdminView['status'],
      tier: customer.tier as CustomerAdminView['tier'],
      email: customer.email,
      phone: customer.phone,
      individual: (customer.individual ?? null) as CustomerAdminView['individual'],
      business: (customer.business ?? null) as CustomerAdminView['business'],
      residentialAddress: (customer.residentialAddress ??
        null) as CustomerAdminView['residentialAddress'],
      postalAddress: (customer.postalAddress ?? null) as CustomerAdminView['postalAddress'],
      avatar: (customer.avatar ?? null) as CustomerAdminView['avatar'],
      preferences: customer.preferences as CustomerAdminView['preferences'],
      kyc: {
        level: customer.kycLevel as CustomerAdminView['kyc']['level'],
        status: customer.kycStatus as CustomerAdminView['kyc']['status'],
        verifiedAt: customer.kycVerifiedAt?.toISOString() ?? null,
        nextReviewAt: customer.kycNextReviewAt?.toISOString() ?? null,
      },
      memberSince: customer.memberSince.toISOString(),
      riskRating: customer.riskRating as CustomerAdminView['riskRating'],
      flags: (customer.flags ?? []) as CustomerAdminView['flags'],
      relationshipManager: customer.relationshipManager,
      totalRelationshipValue: toMoneyDto(relationshipValue, BASE_CURRENCY),
      accountCount: accounts.length,
      lastActivityAt: customer.lastActivityAt?.toISOString() ?? null,
      internalNotes: 0,
    };
  }
}

/** Search text reaches a regex, so metacharacters must be neutralised before it does. */
function escapeRegex(value: string): string {
  return value.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
