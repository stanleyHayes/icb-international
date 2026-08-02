import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError, NotFoundError } from '../../../common/errors/index.js';
import { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { customerDisplayName } from '../../kyc/infrastructure/customer-profile.js';
import { accountIdFromRef, customerRef, toAccountRef } from '../../ledger/domain/account-ref.js';
import { LedgerEntryDoc } from '../../ledger/infrastructure/ledger.schemas.js';

/** The facts about the disputed transaction that the dispute record needs to carry. */
export interface DisputeSubject {
  readonly accountId: string;
  readonly amountMinorUnits: number;
  readonly currency: string;
  readonly customerName: string;
  readonly description: string;
}

/**
 * Resolving "which transaction is this customer disputing?".
 *
 * Ownership is enforced by the query — the entry must sit on an account this customer holds — so
 * a customer cannot raise a dispute against somebody else's transaction by guessing an id. The
 * entry must also be a *debit*: you cannot charge back money that came in.
 */
@Injectable()
export class DisputeSubjectResolver {
  constructor(
    @InjectModel(LedgerEntryDoc.name) private readonly entries: Model<LedgerEntryDoc>,
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    @InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>,
  ) {}

  async resolve(customerId: string, transactionId: string): Promise<DisputeSubject> {
    const accounts = await this.accounts.find({ customerId }).select('_id').lean();
    const refs = accounts.map((account) => customerRef(account._id));

    const rows = refs.length
      ? await this.entries.find({ transactionId, accountRef: { $in: refs } }).lean()
      : [];

    if (rows.length === 0) {
      throw new NotFoundError('Transaction', transactionId);
    }

    const debit = rows.find((row) => row.direction === 'debit');
    if (!debit) {
      throw new ConflictError('Only a payment out of your account can be disputed', {
        transactionId,
      });
    }

    return {
      accountId: accountIdFromRef(toAccountRef(debit.accountRef)),
      amountMinorUnits: debit.minorUnits,
      currency: debit.currency,
      customerName: await this.nameOf(customerId),
      description: debit.narrative ?? 'Card or transfer payment',
    };
  }

  private async nameOf(customerId: string): Promise<string> {
    const customer = await this.customers.findById(customerId).lean();
    if (!customer) {
      throw new NotFoundError('Customer', customerId);
    }
    return customerDisplayName(customer);
  }
}
