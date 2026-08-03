import type { TransferDestination } from '@icb/contracts';
import type { Money } from '@icb/money';
import { Injectable, Logger } from '@nestjs/common';

import { AccountsService } from '../../accounts/accounts.service.js';
import { BeneficiariesService } from '../../beneficiaries/beneficiaries.service.js';
import {
  describeDestination,
  maskIdentifier,
  recipientNameFor,
} from '../domain/recipient.js';

export interface ResolvedDestination {
  /** The effective destination — a beneficiary reference expanded to what it points at. */
  readonly destination: TransferDestination;
  /** The saved payee being paid, when the destination was a beneficiary reference. */
  readonly beneficiaryId: string | null;
  /** The payee's saved name and masked identifier, for receipts and risk signals. */
  readonly beneficiaryName: string | null;
  readonly beneficiaryMasked: string | null;
}

export interface RecipientDisplay {
  readonly name: string;
  readonly masked: string;
}

/**
 * Expands a `beneficiary` destination to the destination it was saved with, and answers what
 * the receipt should call the recipient.
 *
 * Every money-moving path resolves through here, so "what are we actually paying?" has exactly
 * one answer — and the fraud and cooling-off checks downstream always see the same expansion.
 */
@Injectable()
export class DestinationResolver {
  private readonly logger = new Logger(DestinationResolver.name);

  constructor(
    private readonly beneficiaries: BeneficiariesService,
    private readonly accounts: AccountsService,
  ) {}

  async resolve(
    destination: TransferDestination,
    customerId: string,
  ): Promise<ResolvedDestination> {
    if (destination.kind !== 'beneficiary') {
      return { destination, beneficiaryId: null, beneficiaryName: null, beneficiaryMasked: null };
    }
    const beneficiary = await this.beneficiaries.loadOwned(
      destination.beneficiaryId,
      customerId,
    );
    return {
      destination: beneficiary.destination as TransferDestination,
      beneficiaryId: beneficiary._id,
      beneficiaryName: beneficiary.nickname ?? beneficiary.name,
      beneficiaryMasked: beneficiary.displayIdentifier,
    };
  }

  /** The cooling-off and verification caps a saved payee carries — the fraud control. */
  async assertPayable(
    resolved: ResolvedDestination,
    amount: Money,
    customerId: string,
  ): Promise<void> {
    if (resolved.beneficiaryId) {
      await this.beneficiaries.assertUsable(resolved.beneficiaryId, amount, customerId);
    }
  }

  /**
   * `saveBeneficiary` after a successful send. A duplicate is fine — the payee is already
   * saved — and no failure here may fail a completed transfer, so every error is swallowed
   * after logging.
   */
  async savePayee(
    customerId: string,
    destination: TransferDestination,
    name: string,
    nickname?: string,
  ): Promise<void> {
    if (destination.kind === 'own_account' || destination.kind === 'beneficiary') {
      return;
    }
    try {
      await this.beneficiaries.create(customerId, {
        name,
        destination,
        favourite: false,
        ...(nickname ? { nickname } : {}),
      });
    } catch (error) {
      this.logger.warn({ err: error }, 'Beneficiary not saved');
    }
  }

  /** The name and masked identifier the receipt and the transfer document carry. */
  async describe(
    resolved: ResolvedDestination,
    customerId: string,
  ): Promise<RecipientDisplay> {
    const masked =
      resolved.beneficiaryMasked ?? maskIdentifier(describeDestination(resolved.destination));
    if (resolved.beneficiaryName) {
      return { name: resolved.beneficiaryName, masked };
    }
    const named = recipientNameFor(resolved.destination);
    if (named) {
      return { name: named, masked };
    }
    const target = await this.lookupInternalTarget(resolved.destination, customerId);
    return { name: target?.nickname ?? target?.productName ?? 'ICB account', masked };
  }

  /** Own-account and on-us destinations are ICB accounts; the record names them from it. */
  private async lookupInternalTarget(destination: TransferDestination, customerId: string) {
    if (destination.kind === 'own_account') {
      return this.accounts.loadSpendable(destination.accountId, customerId);
    }
    if (destination.kind === 'icb_customer') {
      return this.accounts.findByNumber(destination.accountNumber);
    }
    return null;
  }
}
