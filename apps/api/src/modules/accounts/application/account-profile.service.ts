import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../../common/errors/index.js';
import { AccountDoc } from '../infrastructure/account.schemas.js';

/** Fields of an account the customer may change themselves. */
export interface UpdateAccountPatch {
  readonly nickname?: string | null | undefined;
  readonly primary?: boolean | undefined;
  readonly statementDay?: number | undefined;
}

/**
 * The customer-editable slice of an account: nickname, primary flag, statement day.
 *
 * Everything else about an account — status, overdraft, balance — changes only through a
 * guarded path, so this service can stay deliberately small and uninteresting.
 */
@Injectable()
export class AccountProfileService {
  constructor(
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
  ) {}

  /** Apply the editable fields. Marking an account primary unmarks the customer's others. */
  async update(accountId: string, customerId: string, patch: UpdateAccountPatch): Promise<void> {
    if (patch.primary === true) {
      await this.accounts.updateMany(
        { customerId, _id: { $ne: accountId } },
        { $set: { primary: false } },
      );
    }

    const set: Record<string, unknown> = {};
    if (patch.nickname !== undefined) set['nickname'] = patch.nickname;
    if (patch.primary !== undefined) set['primary'] = patch.primary;
    if (patch.statementDay !== undefined) set['statementDay'] = patch.statementDay;

    const result = await this.accounts.updateOne({ _id: accountId, customerId }, { $set: set });
    if (result.matchedCount === 0) {
      throw new NotFoundError('Account', accountId);
    }
  }
}
