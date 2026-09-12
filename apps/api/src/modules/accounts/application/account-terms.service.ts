import type { AccountDetail } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { NotFoundError, ValidationError } from '../../../common/errors/index.js';
import { customerRef } from '../../ledger/domain/account-ref.js';
import { HoldService } from '../../ledger/hold.service.js';
import { HoldDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import { ProductsService } from '../../products/products.service.js';
import { AccountsService } from '../accounts.service.js';
import { AccountDoc } from '../infrastructure/account.schemas.js';

/**
 * The commercial terms of an open account: which product it sits on, what rate it earns, and
 * the release of a hold that is reserving value it should not.
 *
 * Separate from `AccountStatusService` because these are not lifecycle transitions — the
 * account's standing is untouched. What they share is that an operator is rewriting terms a
 * customer agreed to, so every one of them takes a reason and carries an audit action.
 */
@Injectable()
export class AccountTermsService {
  constructor(
    @InjectModel(AccountDoc.name) private readonly accounts: Model<AccountDoc>,
    @InjectModel(HoldDoc.name) private readonly holds: Model<HoldDoc>,
    private readonly core: AccountsService,
    private readonly products: ProductsService,
    private readonly holdService: HoldService,
  ) {}

  /**
   * Move the account onto a different product.
   *
   * The product-derived figures move with it. They are snapshots on the account rather than
   * lookups through the product, and interest accrual and fee collection read the account's
   * copy — so leaving them behind would put the customer on a new product at the old product's
   * price, which is the kind of divergence nobody notices until a statement is wrong.
   */
  async changeProduct(accountId: string, productCode: string): Promise<AccountDetail> {
    const account = await this.load(accountId);
    const product = await this.products.getByCode(productCode).catch(() => null);
    if (!product) {
      throw new NotFoundError('Product', productCode);
    }

    // A current account cannot become a loan, and a USD account cannot move to a product that
    // is not offered in USD. Both would leave an account the rest of the system cannot service.
    if (product.kind !== account.kind) {
      throw new ValidationError('That product is for a different kind of account', [
        {
          path: 'productCode',
          message: `${product.code} is a ${product.kind} product; this account is ${account.kind}`,
        },
      ]);
    }
    if (!product.currencies.includes(account.currency as (typeof product.currencies)[number])) {
      throw new ValidationError('That product is not offered in this account’s currency', [
        { path: 'productCode', message: `${product.code} does not support ${account.currency}` },
      ]);
    }

    await this.accounts.updateOne(
      { _id: accountId },
      {
        $set: {
          productCode: product.code,
          productName: product.name,
          interestRate: product.interestRate,
          minimumBalanceMinorUnits: product.minimumBalance?.minorUnits ?? null,
          monthlyFeeMinorUnits: product.monthlyFee?.minorUnits ?? null,
        },
      },
    );
    return this.core.getForStaff(accountId);
  }

  /**
   * Set the rate this account earns, or restore the one its product offers.
   *
   * Clearing writes the product's rate rather than `null`, because `null` is not "use the
   * product": interest accrual reads `account.interestRate` directly and falls back to a flat
   * house rate when it is absent. Writing the product's own figure is what actually returns the
   * customer to product terms.
   */
  async setInterestOverride(accountId: string, rate: number | null): Promise<AccountDetail> {
    const account = await this.load(accountId);
    const effective =
      rate ?? (await this.products.getByCode(account.productCode).catch(() => null))?.interestRate ?? null;

    await this.accounts.updateOne({ _id: accountId }, { $set: { interestRate: effective } });
    return this.core.getForStaff(accountId);
  }

  /**
   * Release a hold early — a merchant who abandoned a sale leaves one reserving money the
   * customer should have back.
   *
   * The hold is checked against the account in the path before anything moves: `HoldService`
   * releases by id alone, so without this an operator on one account could free a hold on
   * another. Everything after that — already-released, the balance adjustment, the lock — is
   * the ledger's to enforce.
   */
  async releaseHold(accountId: string, holdId: string, reason: string): Promise<void> {
    await this.load(accountId);
    const hold = await this.holds.findOne({ _id: holdId }, { accountRef: 1 }).lean();
    if (!hold || hold.accountRef !== customerRef(accountId)) {
      throw new NotFoundError('Hold', holdId);
    }
    await this.holdService.release(holdId, reason);
  }

  private async load(accountId: string): Promise<AccountDoc> {
    const account = await this.accounts.findOne({ _id: accountId }).lean();
    if (!account) {
      throw new NotFoundError('Account', accountId);
    }
    return account;
  }
}
