import { Injectable } from '@nestjs/common';

import { NotFoundError, ValidationError } from '../../../../common/errors/index.js';
import { AccountsService } from '../../../accounts/accounts.service.js';
import { FxConversionService } from '../../../fx/fx-conversion.service.js';
import { LedgerService } from '../../../ledger/ledger.service.js';
import type { AccountDoc } from '../../../accounts/infrastructure/account.schemas.js';
import { maskIdentifier } from '../../domain/recipient.js';
import type { PreparedTransfer } from '../transfer-pipeline.types.js';
import { BookTransferUseCase } from './book-transfer.base.js';

/**
 * To another ICB customer, addressed by account number.
 *
 * Same book transfer as `internal` under the name the transfers contract uses — credited
 * directly, final immediately. The recipient is looked up by their published account number,
 * never by an internal id the sender should not know.
 */
@Injectable()
export class OnUsTransferUseCase extends BookTransferUseCase {
  readonly rail = 'on_us' as const;

  constructor(
    ledger: LedgerService,
    fxConversion: FxConversionService,
    private readonly accounts: AccountsService,
  ) {
    super(ledger, fxConversion);
  }

  protected async resolveTarget(prepared: PreparedTransfer): Promise<AccountDoc> {
    if (prepared.destination.kind !== 'icb_customer') {
      throw new ValidationError('An on-us transfer needs an ICB account number', [
        { path: 'destination', message: 'Expected an ICB customer destination' },
      ]);
    }
    const target = await this.accounts.findByNumber(prepared.destination.accountNumber);
    if (!target) {
      throw new NotFoundError(
        'Destination account',
        maskIdentifier(prepared.destination.accountNumber),
      );
    }
    return target;
  }
}
