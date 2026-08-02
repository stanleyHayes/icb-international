import type { AccountDetail, AccountStatus, AccountSummary } from '@icb/contracts';
import { fromMinorUnits, subtract, type CurrencyCode, type Money } from '@icb/money';
import { Inject, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import {
  AccountClosedError,
  AccountFrozenError,
  ConflictError,
  NotFoundError,
} from '../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { customerRef } from '../ledger/domain/account-ref.js';
import { AccountBalanceDoc } from '../ledger/infrastructure/ledger.schemas.js';
import { generateAccountNumber, generateIban } from './domain/account-number.js';
import { toAccountDetail, toAccountSummary } from './infrastructure/account.mapper.js';
import { AccountDoc } from './infrastructure/account.schemas.js';

export interface OpenAccountCommand {
  readonly customerId: string;
  readonly productCode: string;
  readonly productName: string;
  readonly kind: string;
  readonly currency: CurrencyCode;
  readonly nickname?: string;
  readonly primary?: boolean;
  readonly interestRate?: number;
  readonly overdraftMinorUnits?: number;
  readonly entropy?: () => number;
}

/** ICB's institution code inside an IBAN. */
const BANK_CODE = 'ICBK';

@Injectable()
export class AccountsService {
  constructor(
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    @InjectModel(AccountBalanceDoc.name) private readonly balances: Model<AccountBalanceDoc>,
    @Inject(CONFIG) private readonly config: AppConfiguration,
    private readonly clock: ClockService,
  ) {}

  async open(command: OpenAccountCommand, session?: ClientSession): Promise<AccountSummary> {
    const entropy = command.entropy ?? Math.random;
    const number = await this.allocateAccountNumber(entropy);
    const openedAt = this.clock.now();

    const [created] = await this.accounts.create(
      [
        {
          _id: newId(),
          customerId: command.customerId,
          productCode: command.productCode,
          productName: command.productName,
          kind: command.kind,
          number,
          iban: generateIban(this.config.bank.country, BANK_CODE, number),
          bic: this.config.bank.bic,
          sortCode: this.config.bank.sortCode,
          currency: command.currency,
          status: 'active',
          nickname: command.nickname ?? null,
          primary: command.primary ?? false,
          overdraftMinorUnits: command.overdraftMinorUnits ?? 0,
          interestRate: command.interestRate ?? null,
          minimumBalanceMinorUnits: null,
          monthlyFeeMinorUnits: null,
          statementDay: 1,
          lastStatementAt: null,
          openedAt,
          closedAt: null,
          closureReason: null,
        },
      ],
      session ? { session, ordered: true } : { ordered: true },
    );

    if (!created) {
      throw new ConflictError('Account could not be opened');
    }

    await this.seedBalanceRecord(created, session);
    return toAccountSummary(created, this.emptyBalances(command.currency));
  }

  async listForCustomer(customerId: string): Promise<AccountSummary[]> {
    const accounts = await this.accounts
      .find({ customerId, status: { $ne: 'closed' } })
      .sort({ primary: -1, openedAt: 1 })
      .lean();

    const balances = await this.loadBalances(accounts.map((account) => account._id));

    return accounts.map((account) =>
      toAccountSummary(account, balances.get(account._id) ?? this.emptyBalances(account.currency)),
    );
  }

  async getForCustomer(accountId: string, customerId: string): Promise<AccountDetail> {
    const account = await this.accounts.findOne({ _id: accountId, customerId }).lean();
    if (!account) {
      throw new NotFoundError('Account', accountId);
    }
    const balances = await this.loadBalances([accountId]);
    return toAccountDetail(
      account,
      balances.get(accountId) ?? this.emptyBalances(account.currency),
    );
  }

  /**
   * Load an account for a money-moving operation, asserting it can actually be used.
   *
   * Every debit path calls this rather than a bare `findById`, so "is this account frozen?" is
   * answered in one place instead of being forgotten in one of a dozen call sites.
   */
  async loadSpendable(accountId: string, customerId?: string): Promise<AccountDoc> {
    const filter = customerId ? { _id: accountId, customerId } : { _id: accountId };
    const account = await this.accounts.findOne(filter).lean();

    if (!account) {
      throw new NotFoundError('Account', accountId);
    }
    if (account.status === 'closed') {
      throw new AccountClosedError(accountId);
    }
    if (account.status === 'frozen') {
      throw new AccountFrozenError(accountId);
    }
    return account;
  }

  async findByNumber(number: string): Promise<AccountDoc | null> {
    return this.accounts.findOne({ number, status: { $ne: 'closed' } }).lean();
  }

  async setStatus(accountId: string, status: AccountStatus, reason: string): Promise<void> {
    const update: Record<string, unknown> = { status };
    if (status === 'closed') {
      update['closedAt'] = this.clock.now();
      update['closureReason'] = reason;
    }
    const result = await this.accounts.updateOne({ _id: accountId }, { $set: update });
    if (result.matchedCount === 0) {
      throw new NotFoundError('Account', accountId);
    }
  }

  async updateNickname(accountId: string, customerId: string, nickname: string | null): Promise<void> {
    const result = await this.accounts.updateOne(
      { _id: accountId, customerId },
      { $set: { nickname } },
    );
    if (result.matchedCount === 0) {
      throw new NotFoundError('Account', accountId);
    }
  }

  /** Ledger, hold and available balances for one account. */
  async balancesFor(accountId: string, currency: CurrencyCode): Promise<{
    ledger: Money;
    holds: Money;
    available: Money;
  }> {
    const record = await this.balances.findOne({ accountRef: customerRef(accountId), currency }).lean();
    const ledger = fromMinorUnits(record?.ledgerMinorUnits ?? 0, currency);
    const holds = fromMinorUnits(record?.holdMinorUnits ?? 0, currency);
    const overdraft = fromMinorUnits(record?.overdraftMinorUnits ?? 0, currency);

    return {
      ledger,
      holds,
      available: fromMinorUnits(
        subtract(ledger, holds).minorUnits + overdraft.minorUnits,
        currency,
      ),
    };
  }

  private async loadBalances(accountIds: string[]): Promise<Map<string, AccountBalanceRow>> {
    const refs = accountIds.map(customerRef);
    const rows = await this.balances.find({ accountRef: { $in: refs } }).lean();

    return new Map(
      rows.map((row) => [
        row.accountRef.slice('acct:'.length),
        {
          ledgerMinorUnits: row.ledgerMinorUnits,
          holdMinorUnits: row.holdMinorUnits,
          overdraftMinorUnits: row.overdraftMinorUnits,
          currency: row.currency,
          asOf: row.asOf,
        },
      ]),
    );
  }

  private emptyBalances(currency: string): AccountBalanceRow {
    return {
      ledgerMinorUnits: 0,
      holdMinorUnits: 0,
      overdraftMinorUnits: 0,
      currency,
      asOf: this.clock.now(),
    };
  }

  /** Create the balance row up front so an account always has one to read. */
  private async seedBalanceRecord(account: AccountDoc, session?: ClientSession): Promise<void> {
    await this.balances.updateOne(
      { accountRef: customerRef(account._id), currency: account.currency },
      {
        $setOnInsert: {
          _id: newId(),
          accountRef: customerRef(account._id),
          currency: account.currency,
          normalSide: account.kind === 'loan' ? 'debit' : 'credit',
          ledgerMinorUnits: 0,
          debitMinorUnits: 0,
          creditMinorUnits: 0,
          holdMinorUnits: 0,
          overdraftMinorUnits: account.overdraftMinorUnits,
          entryCount: 0,
          asOf: account.openedAt,
        },
      },
      session ? { upsert: true, session } : { upsert: true },
    );
  }

  /** Retry on the (vanishingly rare) collision rather than failing the customer's application. */
  private async allocateAccountNumber(entropy: () => number): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateAccountNumber(entropy);
      const existing = await this.accounts.exists({ number: candidate });
      if (!existing) {
        return candidate;
      }
    }
    throw new ConflictError('Could not allocate a unique account number');
  }
}

export interface AccountBalanceRow {
  ledgerMinorUnits: number;
  holdMinorUnits: number;
  overdraftMinorUnits: number;
  currency: string;
  asOf: Date;
}
