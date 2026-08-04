import type { DepositRateBand, OpenTermDepositRequest, TermDeposit } from '@icb/contracts';
import {
  fromMinorUnits,
  isCurrencyCode,
  isGreaterThan,
  type CurrencyCode,
  type Money,
} from '@icb/money';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { DomainError } from '../../common/errors/domain.error.js';
import {
  ConflictError,
  InsufficientFundsError,
  NotFoundError,
  ValidationError,
} from '../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { newId, newReference } from '../../infrastructure/database/identifier.js';
import { TransactionManager } from '../../infrastructure/database/transaction.manager.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { AccountsService } from '../accounts/accounts.service.js';
import {
  listRateBands,
  minimumDepositMinorUnits,
  resolveRateBand,
} from './domain/rate-bands.js';
import {
  buildDepositDocument,
  type CreateDepositInput,
} from './infrastructure/term-deposit.factory.js';
import { toTermDeposit } from './infrastructure/term-deposit.mapper.js';
import type { UpdateTermDepositRequest } from './infrastructure/term-deposit.requests.js';
import { TermDepositDoc } from './infrastructure/term-deposit.schemas.js';
import { TermDepositPostingService } from './term-deposit-posting.service.js';

/**
 * Term deposits: opening and reading.
 *
 * A deposit is a contract, so it is priced from the published rate card rather than from
 * anything the client sends — the request says how much and how long, and the bank says at what
 * rate. The principal is moved into a dedicated `fixed_deposit` account in the same database
 * transaction that writes the contract, so a deposit can never exist without its money or vice
 * versa.
 */
@Injectable()
export class TermDepositsService {
  private readonly logger = new Logger(TermDepositsService.name);

  constructor(
    @InjectModel(TermDepositDoc.name) private readonly deposits: Model<TermDepositDoc>,
    private readonly accounts: AccountsService,
    private readonly postings: TermDepositPostingService,
    private readonly transactionManager: TransactionManager,
    private readonly clock: ClockService,
    @Inject(CONFIG) private readonly config: AppConfiguration,
  ) {}

  /** The published rate card. Defaults to the bank's base currency. */
  rateCard(currency?: string): DepositRateBand[] {
    const code = currency ?? this.config.bank.baseCurrency;
    if (!isCurrencyCode(code)) {
      throw new ValidationError('That currency is not supported', [
        { path: 'currency', message: `${code} is not a currency this bank deals in` },
      ]);
    }
    return listRateBands(code);
  }

  async open(customerId: string, request: OpenTermDepositRequest): Promise<TermDeposit> {
    const funding = await this.accounts.loadSpendable(request.fromAccountId, customerId);
    const currency = funding.currency as CurrencyCode;
    this.assertCurrency(currency, request.principal.currency);

    const principal = fromMinorUnits(request.principal.minorUnits, currency);
    await this.assertFunds(funding._id, principal);

    const rate = this.priceDeposit(request.termMonths, principal.minorUnits, currency);
    const rolloverAccountId = await this.resolveRolloverAccount(customerId, request, currency);

    const depositId = await this.transactionManager.withTransaction((session) =>
      this.createDeposit(
        {
          customerId,
          fundingAccountId: funding._id,
          principal,
          termMonths: request.termMonths,
          rate,
          maturityInstruction: request.maturityInstruction,
          rolloverAccountId,
          rolledFromDepositId: null,
        },
        session,
      ),
    );

    this.logger.log({ depositId, rate }, 'Term deposit opened');
    return this.get(customerId, depositId);
  }

  /**
   * Create the deposit account, move the principal into it, and write the contract — all inside
   * the caller's session. Shared with the rollover path at maturity.
   */
  async createDeposit(input: CreateDepositInput, session: ClientSession): Promise<string> {
    const id = newId();
    const reference = newReference('TD');

    const accountId = await this.postings.openDepositAccount(
      {
        customerId: input.customerId,
        currency: input.principal.currency,
        termMonths: input.termMonths,
        rate: input.rate,
        reference,
      },
      session,
    );

    await this.postings.postPrincipal(
      id,
      { from: input.fundingAccountId, to: accountId },
      input.principal,
      session,
    );

    const document = buildDepositDocument(input, { id, reference, accountId }, this.clock.now());
    await this.deposits.create([document], { session, ordered: true });
    return id;
  }

  private async assertFunds(accountId: string, principal: Money): Promise<void> {
    const balances = await this.accounts.balancesFor(accountId, principal.currency);
    if (isGreaterThan(principal, balances.available)) {
      throw new InsufficientFundsError(accountId, principal, balances.available);
    }
  }

  /** The bank prices the deposit; the request only says how much and for how long. */
  private priceDeposit(
    termMonths: number,
    principalMinorUnits: number,
    currency: CurrencyCode,
  ): number {
    const band = resolveRateBand(termMonths, principalMinorUnits, currency);
    if (band) {
      return band.rate;
    }
    throw new ValidationError('This amount and term do not qualify for a term deposit', [
      {
        path: 'principal',
        message: `The minimum opening amount is ${minimumDepositMinorUnits(currency)} ${currency} minor units`,
      },
    ]);
  }

  /**
   * Change what happens at maturity. Only while the deposit is live and unmatured: once the
   * lifecycle has run, the instruction has already been acted on and editing it would rewrite
   * history. A nominated rollover account must be the customer's own, in the deposit currency.
   */
  async updateMaturity(
    customerId: string,
    depositId: string,
    patch: UpdateTermDepositRequest,
  ): Promise<TermDeposit> {
    const deposit = await this.loadDeposit(customerId, depositId);
    this.assertUpdatable(deposit);

    const update: Record<string, unknown> = {};
    if (patch.maturityInstruction !== undefined) {
      update['maturityInstruction'] = patch.maturityInstruction;
    }
    if (patch.rolloverAccountId !== undefined) {
      update['rolloverAccountId'] = await this.resolveRolloverPatch(
        customerId,
        deposit.currency as CurrencyCode,
        patch.rolloverAccountId,
      );
    }

    await this.deposits.updateOne({ _id: deposit._id }, { $set: update });
    this.logger.log({ depositId }, 'Term deposit maturity instruction updated');
    return this.get(customerId, depositId);
  }

  private assertUpdatable(deposit: TermDepositDoc): void {
    if (deposit.status !== 'active' || deposit.maturesOn <= this.clock.today()) {
      throw new ConflictError('This deposit can no longer be amended', {
        depositId: deposit._id,
        status: deposit.status,
        maturesOn: deposit.maturesOn,
      });
    }
  }

  /** A new nomination is validated; an explicit null clears it. */
  private async resolveRolloverPatch(
    customerId: string,
    currency: CurrencyCode,
    rolloverAccountId: string | null,
  ): Promise<string | null> {
    if (rolloverAccountId === null) {
      return null;
    }
    const account = await this.accounts.loadSpendable(rolloverAccountId, customerId);
    this.assertCurrency(currency, account.currency);
    return account._id;
  }

  async list(customerId: string): Promise<TermDeposit[]> {
    const rows = await this.deposits.find({ customerId }).sort({ openedAt: -1 }).lean();
    const today = this.clock.today();
    return rows.map((row) => toTermDeposit(row, today));
  }

  async get(customerId: string, depositId: string): Promise<TermDeposit> {
    return toTermDeposit(await this.loadDeposit(customerId, depositId), this.clock.today());
  }

  /** Loads a deposit the customer actually owns. Ownership is the query, not a later comparison. */
  async loadDeposit(customerId: string, depositId: string): Promise<TermDepositDoc> {
    const deposit = await this.deposits.findOne({ _id: depositId, customerId }).lean();
    if (!deposit) {
      throw new NotFoundError('Term deposit', depositId);
    }
    return deposit;
  }

  /** Where the proceeds go at maturity, when the customer has nominated somewhere specific. */
  private async resolveRolloverAccount(
    customerId: string,
    request: OpenTermDepositRequest,
    currency: CurrencyCode,
  ): Promise<string | null> {
    if (!request.rolloverAccountId) {
      return null;
    }
    const account = await this.accounts.loadSpendable(request.rolloverAccountId, customerId);
    this.assertCurrency(currency, account.currency);
    return account._id;
  }

  private assertCurrency(expected: string, actual: string): void {
    if (expected === actual) {
      return;
    }
    throw new DomainError(
      'ACCOUNT_CURRENCY_MISMATCH',
      'A term deposit must be funded in the currency of the funding account',
      { context: { expected, actual } },
    );
  }
}
