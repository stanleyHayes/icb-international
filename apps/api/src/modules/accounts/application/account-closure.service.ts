import { closeAccountRequestSchema, type AccountDetail } from '@icb/contracts';
import type { CurrencyCode, Money } from '@icb/money';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { z } from 'zod';

import { NotFoundError } from '../../../common/errors/index.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { customerRef } from '../../ledger/domain/account-ref.js';
import { LedgerService } from '../../ledger/ledger.service.js';
import { AccountsService } from '../accounts.service.js';
import {
  AccountCurrencyMismatchError,
  AccountNotEmptyError,
} from '../domain/account.errors.js';
import { AccountDoc } from '../infrastructure/account.schemas.js';

type CloseAccountRequest = z.infer<typeof closeAccountRequestSchema>;

/**
 * Closing an account.
 *
 * The rule that makes this a banking operation rather than a status flag: an account holding
 * value cannot simply vanish. Either the balance is already zero, or the caller names a sweep
 * destination and the residual moves there — through the ledger, so the money trail survives
 * the account. Outstanding holds block closing outright: that money is already committed.
 */
@Injectable()
export class AccountClosureService {
  constructor(
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    private readonly core: AccountsService,
    private readonly ledger: LedgerService,
    private readonly clock: ClockService,
  ) {}

  async close(
    accountId: string,
    customerId: string,
    request: CloseAccountRequest,
  ): Promise<AccountDetail> {
    const account = await this.accounts.findOne({ _id: accountId, customerId }).lean();
    if (!account) {
      throw new NotFoundError('Account', accountId);
    }
    if (account.status === 'closed') {
      return this.core.getForCustomer(accountId, customerId);
    }

    const currency = account.currency as CurrencyCode;
    const balances = await this.core.balancesFor(accountId, currency);
    this.assertNoHolds(account, balances.holds);
    if (balances.ledger.minorUnits !== 0) {
      await this.sweepOrRefuse(account, balances.ledger, request.sweepToAccountId);
    }

    await this.accounts.updateOne(
      { _id: accountId },
      { $set: { status: 'closed', closedAt: this.clock.now(), closureReason: request.reason } },
    );
    return this.core.getForCustomer(accountId, customerId);
  }

  /** Holds commit value the customer has already spent; closing would strand them. */
  private assertNoHolds(account: AccountDoc, holds: Money): void {
    if (holds.minorUnits !== 0) {
      throw new AccountNotEmptyError(account._id, holds, holds);
    }
  }

  /** Sweep the residual to a named account, or refuse the close with a typed error. */
  private async sweepOrRefuse(
    account: AccountDoc,
    ledger: Money,
    sweepToAccountId: string | undefined,
  ): Promise<void> {
    // An overdrawn account owes the bank; there is nothing to sweep and the debt must be
    // settled before closure.
    if (!sweepToAccountId || ledger.minorUnits < 0) {
      throw new AccountNotEmptyError(account._id, ledger, ledger);
    }
    const target = await this.core.loadSpendable(sweepToAccountId, account.customerId);
    if (target.currency !== account.currency) {
      throw new AccountCurrencyMismatchError(account._id, account.currency, target.currency);
    }
    await this.ledger.post({
      type: 'transfer_out',
      description: 'Account closure sweep',
      actor: { kind: 'customer', id: account.customerId, label: 'account closure' },
      lines: [
        { accountRef: customerRef(account._id), direction: 'debit', amount: ledger },
        { accountRef: customerRef(target._id), direction: 'credit', amount: ledger },
      ],
    });
  }
}
