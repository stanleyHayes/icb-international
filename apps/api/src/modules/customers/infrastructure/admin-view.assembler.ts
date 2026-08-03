import type { CustomerAdminView } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import { AccountDoc } from '../../accounts/infrastructure/account.schemas.js';
import { customerRef } from '../../ledger/domain/account-ref.js';
import { AccountBalanceDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import { BASE_CURRENCY } from '../customers.constants.js';
import { CustomerNoteDoc } from './customer-note.schemas.js';
import { toCustomerAdminView } from './customer.mapper.js';
import type { CustomerDoc } from './customer.schemas.js';

/**
 * Builds the back-office 360° view of a customer.
 *
 * The view is a profile plus three computed numbers — open-account count, relationship value
 * in the base currency, and the staff-note count — each owned by a different collection. They
 * are assembled here, once, so every admin route that returns a customer agrees on what those
 * numbers mean. Balances are only ever *read* from the ledger's cache (N4).
 */
@Injectable()
export class AdminViewAssembler {
  constructor(
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    @InjectModel(AccountBalanceDoc.name) private readonly balances: Model<AccountBalanceDoc>,
    @InjectModel(CustomerNoteDoc.name) private readonly notes: Model<CustomerNoteDoc>,
  ) {}

  async assemble(customer: CustomerDoc): Promise<CustomerAdminView> {
    const openAccounts = await this.accounts
      .find({ customerId: customer._id, status: { $ne: 'closed' } })
      .select('_id')
      .lean();

    const [balances, noteCount] = await Promise.all([
      this.balances
        .find({
          accountRef: { $in: openAccounts.map((account) => customerRef(account._id)) },
          currency: BASE_CURRENCY,
        })
        .lean(),
      this.notes.countDocuments({ customerId: customer._id }),
    ]);

    const relationshipValue = balances.reduce((total, row) => total + row.ledgerMinorUnits, 0);
    return toCustomerAdminView(customer, {
      totalRelationshipValue: toMoneyDto(relationshipValue, BASE_CURRENCY),
      accountCount: openAccounts.length,
      internalNotes: noteCount,
    });
  }
}
