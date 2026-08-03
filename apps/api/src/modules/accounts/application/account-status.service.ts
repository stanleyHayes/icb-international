import type { AccountDetail, AccountStatus } from '@icb/contracts';
import type { CurrencyCode } from '@icb/money';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { AccountsService } from '../accounts.service.js';
import { assertTransition } from '../domain/account-status-machine.js';
import { AccountNotEmptyError } from '../domain/account.errors.js';
import { AccountDoc } from '../infrastructure/account.schemas.js';

/**
 * Staff-driven account lifecycle: freeze, unfreeze, dormancy, administrative closure.
 *
 * Unlike the legacy `AccountsService.setStatus` primitive (used by system processes that have
 * already done their own checks), every transition here goes through the state machine, and
 * closing additionally enforces the empty-account rule — an operator fat-fingering "close" on a
 * funded account is exactly what the rule exists for.
 */
@Injectable()
export class AccountStatusService {
  constructor(
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    private readonly core: AccountsService,
    private readonly clock: ClockService,
  ) {}

  async transition(
    accountId: string,
    to: AccountStatus,
    reason: string,
  ): Promise<AccountDetail> {
    const account = await this.load(accountId);
    const from = account.status as AccountStatus;
    assertTransition(accountId, from, to);

    if (to === 'closed') {
      await this.assertCloseable(accountId, account.currency as CurrencyCode);
    }
    if (from !== to) {
      await this.accounts.updateOne({ _id: accountId }, { $set: this.statusUpdate(to, reason) });
    }
    return this.core.getForCustomer(accountId, account.customerId);
  }

  /** Set the agreed overdraft. Written to the account, never to the ledger's balance cache. */
  async setOverdraft(accountId: string, limitMinorUnits: number): Promise<AccountDetail> {
    const account = await this.load(accountId);
    await this.accounts.updateOne(
      { _id: accountId },
      { $set: { overdraftMinorUnits: limitMinorUnits } },
    );
    return this.core.getForCustomer(accountId, account.customerId);
  }

  /** Administrative closure obeys the same empty-account rule as a customer's own close. */
  private async assertCloseable(accountId: string, currency: CurrencyCode): Promise<void> {
    const balances = await this.core.balancesFor(accountId, currency);
    if (balances.ledger.minorUnits !== 0 || balances.holds.minorUnits !== 0) {
      throw new AccountNotEmptyError(accountId, balances.ledger, balances.holds);
    }
  }

  private statusUpdate(to: AccountStatus, reason: string): Record<string, unknown> {
    const update: Record<string, unknown> = { status: to };
    if (to === 'closed') {
      update['closedAt'] = this.clock.now();
      update['closureReason'] = reason;
    }
    return update;
  }

  private async load(accountId: string): Promise<AccountDoc> {
    const account = await this.accounts.findOne({ _id: accountId }).lean();
    if (!account) {
      throw new NotFoundError('Account', accountId);
    }
    return account;
  }
}
