import type { AccountDetail, OpenAccountRequest } from '@icb/contracts';
import { fromMinorUnits, type CurrencyCode } from '@icb/money';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { AccountsService } from '../accounts.service.js';
import { assertWithinAccountLimits } from '../domain/account-limits.js';
import { AccountCurrencyMismatchError } from '../domain/account.errors.js';
import { getSelfServeProduct } from '../domain/product-catalogue.js';
import { customerRef, glRef } from '../../ledger/domain/account-ref.js';
import { GL_CASH } from '../../ledger/domain/chart-of-accounts.js';
import { LedgerService } from '../../ledger/ledger.service.js';
import { AccountDoc } from '../infrastructure/account.schemas.js';

/**
 * The self-serve account opening path (`POST /accounts`).
 *
 * This is where product resolution, per-customer limits and the optional opening deposit live.
 * The raw write stays in `AccountsService.open`, which internal modules (fixed deposits, loans)
 * use without self-serve caps — a customer's twentieth term deposit must still open.
 */
@Injectable()
export class AccountOpeningService {
  constructor(
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    private readonly core: AccountsService,
    private readonly ledger: LedgerService,
  ) {}

  async openForCustomer(customerId: string, request: OpenAccountRequest): Promise<AccountDetail> {
    const product = getSelfServeProduct(request.productCode);
    const currency = request.currency;

    const existing = await this.accounts.find({ customerId }).lean();
    assertWithinAccountLimits(existing, product.code, currency);

    if (request.initialDeposit && request.initialDeposit.currency !== currency) {
      throw new AccountCurrencyMismatchError('new', currency, request.initialDeposit.currency);
    }

    const opened = await this.core.open({
      customerId,
      productCode: product.code,
      productName: product.name,
      kind: product.kind,
      currency,
      overdraftMinorUnits: product.overdraftMinorUnits,
      interestRate: product.interestRate,
      ...(request.nickname !== undefined ? { nickname: request.nickname } : {}),
    });

    if (request.initialDeposit) {
      await this.postOpeningDeposit(opened.id, currency, request.initialDeposit.minorUnits);
    }

    return this.core.getForCustomer(opened.id, customerId);
  }

  /** The customer's first money in: cash the bank holds, a deposit it owes. */
  private async postOpeningDeposit(
    accountId: string,
    currency: CurrencyCode,
    minorUnits: number,
  ): Promise<void> {
    const amount = fromMinorUnits(minorUnits, currency);
    await this.ledger.post({
      type: 'deposit',
      description: 'Opening deposit',
      actor: { kind: 'customer', id: accountId, label: 'account opening' },
      lines: [
        { accountRef: glRef(GL_CASH), direction: 'debit', amount },
        { accountRef: customerRef(accountId), direction: 'credit', amount },
      ],
    });
  }
}
