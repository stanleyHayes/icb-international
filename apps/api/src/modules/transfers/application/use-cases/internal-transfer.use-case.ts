import { Injectable } from '@nestjs/common';

import { NotFoundError } from '../../../../common/errors/index.js';
import { AccountsService } from '../../../accounts/accounts.service.js';
import { FxConversionService } from '../../../fx/fx-conversion.service.js';
import { LedgerService } from '../../../ledger/ledger.service.js';
import type { AccountDoc } from '../../../accounts/infrastructure/account.schemas.js';
import type { PreparedTransfer } from '../transfer-pipeline.types.js';
import { BookTransferUseCase } from './book-transfer.base.js';

/**
 * Between two accounts of the same customer.
 *
 * The destination is addressed by account id and must belong to the sender — moving money to
 * someone else's account by id would be an on-us transfer wearing no disguise.
 */
@Injectable()
export class InternalTransferUseCase extends BookTransferUseCase {
  readonly rail = 'internal' as const;

  constructor(
    ledger: LedgerService,
    fxConversion: FxConversionService,
    private readonly accounts: AccountsService,
  ) {
    super(ledger, fxConversion);
  }

  protected async resolveTarget(prepared: PreparedTransfer): Promise<AccountDoc> {
    if (prepared.destination.kind !== 'own_account') {
      throw new NotFoundError('Destination account', prepared.destination.kind);
    }
    return this.accounts.loadSpendable(prepared.destination.accountId, prepared.customerId);
  }
}
