import type { TransactionType } from '@icb/contracts';
import {
  fromMinorUnits,
  getMinorUnitFactor,
  isGreaterThan,
  type CurrencyCode,
  type Money,
} from '@icb/money';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AccountsService } from '../../modules/accounts/accounts.service.js';
import { AccountDoc } from '../../modules/accounts/infrastructure/account.schemas.js';
import { customerRef, glRef, type AccountRef } from '../../modules/ledger/domain/account-ref.js';
import {
  GL_CASH,
  GL_FEE_INCOME,
  GL_FRAUD_LOSSES,
  GL_FX_INCOME,
  GL_INTEREST_EXPENSE,
} from '../../modules/ledger/domain/chart-of-accounts.js';
import type { PostingActor } from '../../modules/ledger/domain/posting.types.js';
import { LedgerService } from '../../modules/ledger/ledger.service.js';
import { ClockService } from '../clock/clock.service.js';
import { RailRegistry } from '../rails/rail.registry.js';

/** The minimum a scenario needs to know about an account to act on it. */
export interface ScenarioAccount {
  readonly id: string;
  readonly customerId: string;
  readonly number: string;
  readonly kind: string;
  readonly status: string;
  readonly currency: CurrencyCode;
}

/** Every simulated event is booked by the bank itself, never attributed to a customer. */
export const SIMULATION_ACTOR: PostingActor = {
  kind: 'system',
  id: null,
  label: 'simulation',
};

export interface MovementOptions {
  readonly type: TransactionType;
  readonly description: string;
  readonly narrative?: string;
  readonly reference?: string;
}

/**
 * What a scenario is allowed to do.
 *
 * Scenarios describe *what happens*, never *how it is recorded*: every movement here is a
 * balanced two-leg posting through LedgerService, so a scenario cannot invent a document, skip
 * the ledger, or leave the books unbalanced no matter how it is written.
 */
@Injectable()
export class ScenarioToolkit {
  constructor(
    @InjectModel(AccountDoc.name) private readonly accountModel: Model<AccountDoc>,
    private readonly accounts: AccountsService,
    private readonly ledger: LedgerService,
    private readonly clock: ClockService,
    readonly rails: RailRegistry,
  ) {}

  now(): Date {
    return this.clock.now();
  }

  /** Accounts a scenario can act on, oldest first so a replay picks the same ones. */
  async pickAccounts(
    kinds: readonly string[],
    limit: number,
    status = 'active',
  ): Promise<ScenarioAccount[]> {
    const rows = await this.accountModel
      .find({ kind: { $in: kinds }, status })
      .sort({ openedAt: 1, _id: 1 })
      .limit(limit)
      .lean();

    return rows.map((row) => ({
      id: row._id,
      customerId: row.customerId,
      number: row.number,
      kind: row.kind,
      status: row.status,
      currency: row.currency as CurrencyCode,
    }));
  }

  async availableBalance(account: ScenarioAccount): Promise<Money> {
    const balances = await this.accounts.balancesFor(account.id, account.currency);
    return balances.available;
  }

  /** Money arriving from outside the bank: cash asset up, customer liability up. */
  async receive(account: ScenarioAccount, amount: Money, options: MovementOptions): Promise<void> {
    await this.movePair(glRef(GL_CASH), customerRef(account.id), amount, options);
  }

  /**
   * Money leaving the customer. Returns false when the balance will not cover it — a scenario
   * that overdrew an account would break the ledger invariant it exists to demonstrate.
   */
  async spend(account: ScenarioAccount, amount: Money, options: MovementOptions): Promise<boolean> {
    const available = await this.availableBalance(account);
    if (isGreaterThan(amount, available)) {
      return false;
    }
    await this.movePair(customerRef(account.id), glRef(GL_CASH), amount, options);
    return true;
  }

  /** A fee: customer liability down, fee income up. */
  async charge(account: ScenarioAccount, amount: Money, options: MovementOptions): Promise<boolean> {
    const available = await this.availableBalance(account);
    if (isGreaterThan(amount, available)) {
      return false;
    }
    await this.movePair(customerRef(account.id), glRef(GL_FEE_INCOME), amount, options);
    return true;
  }

  /** Interest paid to a customer: interest expense up, customer liability up. */
  async payInterest(
    account: ScenarioAccount,
    amount: Money,
    options: MovementOptions,
  ): Promise<void> {
    await this.movePair(glRef(GL_INTEREST_EXPENSE), customerRef(account.id), amount, options);
  }

  /** A provisional credit while a dispute is investigated: the bank carries the loss meanwhile. */
  async provisionalCredit(
    account: ScenarioAccount,
    amount: Money,
    options: MovementOptions,
  ): Promise<void> {
    await this.movePair(glRef(GL_FRAUD_LOSSES), customerRef(account.id), amount, options);
  }

  /** An on-us transfer between two customer accounts. */
  async internalTransfer(
    from: ScenarioAccount,
    to: ScenarioAccount,
    amount: Money,
    options: MovementOptions,
  ): Promise<boolean> {
    const available = await this.availableBalance(from);
    if (isGreaterThan(amount, available)) {
      return false;
    }
    await this.movePair(customerRef(from.id), customerRef(to.id), amount, options);
    return true;
  }

  /** An FX revaluation. A gain credits FX income; a loss debits it. */
  async revalue(amount: Money, gain: boolean, options: MovementOptions): Promise<void> {
    const pair: [AccountRef, AccountRef] = gain
      ? [glRef(GL_CASH), glRef(GL_FX_INCOME)]
      : [glRef(GL_FX_INCOME), glRef(GL_CASH)];
    await this.movePair(pair[0], pair[1], amount, options);
  }

  async reactivate(account: ScenarioAccount): Promise<void> {
    await this.accounts.setStatus(account.id, 'active', 'Reactivated by simulation');
  }

  /** The one posting primitive. Two legs, equal and opposite, always balanced. */
  private async movePair(
    debit: AccountRef,
    credit: AccountRef,
    amount: Money,
    options: MovementOptions,
  ): Promise<void> {
    await this.ledger.post({
      type: options.type,
      description: options.description,
      actor: SIMULATION_ACTOR,
      sourceType: 'scenario',
      lines: [
        { accountRef: debit, direction: 'debit', amount, ...narrativeOf(options) },
        { accountRef: credit, direction: 'credit', amount, ...narrativeOf(options) },
      ],
      ...(options.reference ? { reference: options.reference } : {}),
    });
  }

  /** An integer minor-unit figure as Money. */
  minor(units: number, currency: CurrencyCode): Money {
    return fromMinorUnits(units, currency);
  }

  /** A whole-currency figure as integer minor units, scaled by the currency's own factor. */
  major(units: number, currency: CurrencyCode): Money {
    return fromMinorUnits(Math.round(units) * getMinorUnitFactor(currency), currency);
  }
}

function narrativeOf(options: MovementOptions): { narrative?: string } {
  return options.narrative === undefined ? {} : { narrative: options.narrative };
}
