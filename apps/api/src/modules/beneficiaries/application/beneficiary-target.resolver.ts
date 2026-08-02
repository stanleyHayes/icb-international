import type { TransferDestination } from '@icb/contracts';
import { Inject, Injectable } from '@nestjs/common';

import { NotFoundError, ValidationError } from '../../../common/errors/index.js';
import { CONFIG, type AppConfiguration } from '../../../config/configuration.js';
import { AccountsService } from '../../accounts/accounts.service.js';
import {
  destinationIdentifier,
  maskIdentifier,
} from '../domain/beneficiary-destination.js';

/** Everything about a destination that is worth denormalising onto the saved payee. */
export interface BeneficiaryTarget {
  readonly displayIdentifier: string;
  readonly bankName: string | null;
  readonly currency: string | null;
  /** Present only when the destination is an ICB account, which is what makes it creditable. */
  readonly icbAccountId: string | null;
}

/**
 * Turns a destination into the display and routing facts a saved payee carries.
 *
 * Resolution happens once, at save time, so the list endpoint never fans out into the accounts
 * collection and so an internal payee that points at nothing is rejected before it is stored
 * rather than at the moment someone tries to pay it.
 */
@Injectable()
export class BeneficiaryTargetResolver {
  constructor(
    private readonly accounts: AccountsService,
    @Inject(CONFIG) private readonly config: AppConfiguration,
  ) {}

  async resolve(destination: TransferDestination, customerId: string): Promise<BeneficiaryTarget> {
    switch (destination.kind) {
      case 'own_account':
        return this.internal(await this.accounts.loadSpendable(destination.accountId, customerId));
      case 'icb_customer':
        return this.internal(await this.findByNumber(destination.accountNumber));
      case 'domestic_bank':
        return this.external(destination, null);
      case 'international':
        return this.external(destination, destination.bankName ?? null);
      case 'beneficiary':
        throw new ValidationError('A saved payee cannot point at another saved payee', [
          { path: 'destination.kind', message: 'Choose a real destination, not a beneficiary' },
        ]);
    }
  }

  private async findByNumber(accountNumber: string) {
    const account = await this.accounts.findByNumber(accountNumber);
    if (!account) {
      throw new NotFoundError('Destination account', accountNumber);
    }
    return account;
  }

  private internal(account: { _id: string; number: string; currency: string }): BeneficiaryTarget {
    return {
      displayIdentifier: maskIdentifier(account.number),
      bankName: this.config.bank.name,
      currency: account.currency,
      icbAccountId: account._id,
    };
  }

  /** An external payee's currency is unknown until the rail tells us, so it stays null. */
  private external(destination: TransferDestination, bankName: string | null): BeneficiaryTarget {
    return {
      displayIdentifier: maskIdentifier(destinationIdentifier(destination)),
      bankName,
      currency: null,
      icbAccountId: null,
    };
  }
}
