import { fromDecimalNumber, type CurrencyCode } from '@icb/money';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConflictError } from '../../common/errors/index.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { CONFIG, type AppConfiguration } from '../../config/configuration.js';
import { AccountsService } from '../../modules/accounts/accounts.service.js';
import { customerRef, glRef } from '../../modules/ledger/domain/account-ref.js';
import { GL_CASH, GL_INTEREST_EXPENSE } from '../../modules/ledger/domain/chart-of-accounts.js';
import { LedgerService } from '../../modules/ledger/ledger.service.js';
import { ClockService } from '../clock/clock.service.js';
import { DatabaseResetService } from './database-reset.service.js';
import { SeedIdentityService } from './seed-identity.service.js';
import { createHelpers, type RandomHelpers } from './random.js';
import {
  DISCRETIONARY_MERCHANTS,
  PRODUCTS,
  RECURRING_OUTGOINGS,
  SEED_PERSONAS,
  SEED_STAFF,
  STAFF_PASSWORD,
  type SeedPersona,
} from './seed.data.js';

/** How far back the demo bank's statement history runs, unless a caller asks for less. */
const HISTORY_MONTHS = 18;

export interface SeedOptions {
  readonly reset: boolean;
  readonly seed: string;
  /**
   * Months of transaction history per account. Defaults to {@link HISTORY_MONTHS}.
   *
   * Eighteen months is what makes the demo bank feel lived-in, and it costs ~2,700 postings —
   * every one of them a real ledger transaction, serialised per account. A caller that only
   * needs the *shape* of a populated bank (the contract suite boots one per file) should ask
   * for the smallest history that still fills every collection, rather than pay for the story.
   */
  readonly historyMonths?: number;
}

export interface SeedResult {
  customers: number;
  accounts: number;
  transactions: number;
  logins: { email: string; password: string; role: string }[];
}

/**
 * Builds a whole bank.
 *
 * Everything is posted through LedgerService, never inserted directly, so the seeded database is
 * subject to exactly the same invariants as production traffic — which is what makes
 * `pnpm verify:ledger` a real test rather than a formality.
 */
@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    private readonly accounts: AccountsService,
    private readonly ledger: LedgerService,
    private readonly clock: ClockService,
    private readonly identities: SeedIdentityService,
    private readonly databaseReset: DatabaseResetService,
    @Inject(CONFIG) private readonly config: AppConfiguration,
  ) {}

  async run(options: SeedOptions): Promise<SeedResult> {
    if (options.reset) {
      await this.reset();
    } else {
      await this.assertEmpty();
    }

    const historyMonths = options.historyMonths ?? HISTORY_MONTHS;
    const random = createHelpers(options.seed);
    const result: SeedResult = { customers: 0, accounts: 0, transactions: 0, logins: [] };

    for (const persona of SEED_PERSONAS) {
      const counts = await this.seedPersona(persona, random, historyMonths);
      result.customers += 1;
      result.accounts += counts.accounts;
      result.transactions += counts.transactions;
      result.logins.push({ email: persona.email, password: persona.password, role: 'customer' });
    }

    for (const staff of SEED_STAFF) {
      await this.identities.createStaff(staff, STAFF_PASSWORD);
      result.logins.push({
        email: staff.email,
        password: STAFF_PASSWORD,
        role: staff.roles.join(', '),
      });
    }

    const adminEmail = this.config.seed.initialAdminEmail;
    if (SEED_STAFF.some((staff) => staff.email === adminEmail)) {
      throw new ConflictError(
        `INITIAL_ADMIN_EMAIL (${adminEmail}) collides with a built-in staff seed account. Choose a distinct address.`,
        { adminEmail },
      );
    }

    await this.identities.createStaff(
      { email: adminEmail, roles: ['super_admin'] },
      this.config.seed.initialAdminPassword,
    );
    result.logins.push({
      email: adminEmail,
      password: this.config.seed.initialAdminPassword,
      role: 'super_admin',
    });

    this.logger.log(result, 'Seed complete');
    return result;
  }

  async reset(): Promise<void> {
    await this.databaseReset.clearSeededCollections();
  }

  /**
   * Refuse to seed on top of an existing bank.
   *
   * Without this the run dies partway through on a duplicate-key error, having already written
   * some customers and none of their accounts — a database in a state no code expects. Stopping
   * before the first write leaves what is already there untouched and says what to do instead.
   */
  private async assertEmpty(): Promise<void> {
    const existing = await this.identities.countCustomers();
    if (existing === 0) {
      return;
    }

    throw new ConflictError(
      `The database already holds ${existing} customers. Run \`pnpm db:reset\` to clear the seeded collections and build the bank again.`,
      { customers: existing },
    );
  }

  private async seedPersona(
    persona: SeedPersona,
    random: RandomHelpers,
    historyMonths: number,
  ): Promise<{ accounts: number; transactions: number }> {
    const customerId = newId();
    const currency = persona.currency as CurrencyCode;

    await this.identities.createPersona(persona, customerId, random);

    const current = await this.accounts.open({
      customerId,
      productCode: PRODUCTS[0].code,
      productName: PRODUCTS[0].name,
      kind: PRODUCTS[0].kind,
      currency,
      primary: true,
      interestRate: PRODUCTS[0].interestRate,
      overdraftMinorUnits: PRODUCTS[0].overdraft,
      entropy: random.next,
    });

    const savings = await this.accounts.open({
      customerId,
      productCode: PRODUCTS[1].code,
      productName: PRODUCTS[1].name,
      kind: PRODUCTS[1].kind,
      currency,
      nickname: 'Reserve',
      interestRate: PRODUCTS[1].interestRate,
      entropy: random.next,
    });

    let transactions = 0;
    transactions += await this.fundAccount(current.id, persona.openingBalance, currency, 'Account opening deposit');
    transactions += await this.fundAccount(savings.id, persona.savingsBalance, currency, 'Savings opening deposit');
    transactions += await this.generateHistory(current.id, persona, currency, random, historyMonths);

    return { accounts: 2, transactions };
  }

  /** Opening balances come from the bank's cash account, so the books stay balanced. */
  private async fundAccount(
    accountId: string,
    amountMajor: number,
    currency: CurrencyCode,
    description: string,
  ): Promise<number> {
    const amount = fromDecimalNumber(amountMajor, currency);
    await this.ledger.post({
      type: 'deposit',
      description,
      actor: { kind: 'system', id: null, label: 'seed' },
      lines: [
        { accountRef: glRef(GL_CASH), direction: 'debit', amount },
        { accountRef: customerRef(accountId), direction: 'credit', amount, narrative: description },
      ],
    });
    return 1;
  }

  /**
   * Plausible activity month by month: salary in, recurring bills out, discretionary spend
   * scattered through each month, and interest paid on the savings balance.
   */
  private async generateHistory(
    accountId: string,
    persona: SeedPersona,
    currency: CurrencyCode,
    random: RandomHelpers,
    historyMonths: number,
  ): Promise<number> {
    const today = this.clock.now();
    let count = 0;

    for (let monthsAgo = historyMonths; monthsAgo >= 0; monthsAgo -= 1) {
      const month = new Date(
        Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - monthsAgo, 1),
      );
      count += await this.postMonth(accountId, persona, currency, month, random);
    }

    return count;
  }

  private async postMonth(
    accountId: string,
    persona: SeedPersona,
    currency: CurrencyCode,
    month: Date,
    random: RandomHelpers,
  ): Promise<number> {
    const daysInMonth = new Date(
      Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0),
    ).getUTCDate();
    let count = 0;

    const salaryDate = this.dateIn(month, Math.min(25, daysInMonth));
    if (salaryDate <= this.clock.now()) {
      await this.postCredit(
        accountId,
        random.jitter(persona.monthlySalary, 0.04),
        currency,
        `Salary — ${persona.firstName === 'Olu' ? 'Adeyemi Holdings' : 'Meridian Group'}`,
        salaryDate,
      );
      count += 1;
    }

    for (const outgoing of RECURRING_OUTGOINGS) {
      const date = this.dateIn(month, Math.min(outgoing.day, daysInMonth));
      if (date > this.clock.now()) continue;
      await this.postDebit(
        accountId,
        random.jitter(persona.monthlySalary * outgoing.fraction, 0.06),
        currency,
        outgoing.merchant,
        date,
      );
      count += 1;
    }

    const discretionaryCount = random.int(14, 26);
    for (let index = 0; index < discretionaryCount; index += 1) {
      const date = this.dateIn(month, random.int(1, daysInMonth));
      if (date > this.clock.now()) continue;
      const merchant = random.pick(DISCRETIONARY_MERCHANTS);
      const scale = persona.monthlySalary / 4000;
      await this.postDebit(
        accountId,
        random.float(merchant.min, merchant.max) * scale,
        currency,
        merchant.name,
        date,
      );
      count += 1;
    }

    return count;
  }

  private async postCredit(
    accountId: string,
    amountMajor: number,
    currency: CurrencyCode,
    description: string,
    at: Date,
  ): Promise<void> {
    const amount = fromDecimalNumber(round2(amountMajor), currency);
    await this.ledger.post({
      type: 'transfer_in',
      description,
      actor: { kind: 'system', id: null, label: 'seed' },
      valueDate: this.clock.toIsoDate(at),
      lines: [
        { accountRef: glRef(GL_CASH), direction: 'debit', amount },
        { accountRef: customerRef(accountId), direction: 'credit', amount, narrative: description },
      ],
    });
  }

  private async postDebit(
    accountId: string,
    amountMajor: number,
    currency: CurrencyCode,
    description: string,
    at: Date,
  ): Promise<void> {
    const amount = fromDecimalNumber(round2(amountMajor), currency);
    await this.ledger.post({
      type: 'card_purchase',
      description,
      actor: { kind: 'system', id: null, label: 'seed' },
      valueDate: this.clock.toIsoDate(at),
      lines: [
        { accountRef: customerRef(accountId), direction: 'debit', amount, narrative: description },
        { accountRef: glRef(GL_CASH), direction: 'credit', amount },
      ],
    });
  }

  private dateIn(month: Date, day: number): Date {
    return new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day, 10, 0, 0));
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Kept for the interest-accrual seed step introduced with the accruals module. */
export const SEED_INTEREST_EXPENSE_ACCOUNT = GL_INTEREST_EXPENSE;
