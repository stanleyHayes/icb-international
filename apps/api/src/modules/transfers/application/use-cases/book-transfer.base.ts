import type { TransferRail } from '@icb/contracts';
import type { ClientSession } from 'mongoose';

import { customerRef } from '../../../ledger/domain/account-ref.js';
import { balanceKey } from '../../../ledger/domain/balance-key.js';
import { type LedgerService } from '../../../ledger/ledger.service.js';
import { type AccountDoc } from '../../../accounts/infrastructure/account.schemas.js';
import { type FxConversionService } from '../../../fx/fx-conversion.service.js';
import type { PreparedTransfer, TransferExecution } from '../transfer-pipeline.types.js';
import { buildFeeLines, buildValueLines } from './posting-lines.js';
import type { RailTransferUseCase } from './rail-transfer.use-case.js';

/**
 * Shared behaviour of the two book-transfer rails.
 *
 * Internal and on-us both credit another ICB account directly and are final the moment the
 * posting commits — there is no outside world to wait on. What differs between them is only how
 * the recipient account is found, which each subclass answers for itself.
 */
export abstract class BookTransferUseCase implements RailTransferUseCase {
  abstract readonly rail: TransferRail;

  constructor(
    private readonly ledger: LedgerService,
    private readonly fxConversion: FxConversionService,
  ) {}

  /** How this rail finds the recipient's account — the only variation between the two. */
  protected abstract resolveTarget(prepared: PreparedTransfer): Promise<AccountDoc>;

  /**
   * A book transfer credits a second ICB customer, so it contends on their balance too.
   *
   * Resolving the target twice is deliberate: the lock has to be held before the transaction
   * opens, and an account's identity does not change between the two reads.
   */
  async contendedKeys(prepared: PreparedTransfer): Promise<string[]> {
    const target = await this.resolveTarget(prepared);
    return [balanceKey(customerRef(target._id), prepared.credit.currency)];
  }

  async execute(prepared: PreparedTransfer, session: ClientSession): Promise<TransferExecution> {
    const target = await this.resolveTarget(prepared);
    const narrative = `Transfer to ${prepared.recipientMasked}`;

    const lines = [
      ...buildValueLines(prepared, customerRef(target._id), this.fxConversion, narrative),
      ...buildFeeLines(prepared, narrative),
    ];

    const transaction = await this.ledger.postWithin(
      {
        type: 'transfer_out',
        description: narrative,
        actor: { kind: 'customer', id: prepared.customerId, label: prepared.source.number },
        lines,
        reference: prepared.reference,
        status: 'posted',
        sourceType: 'transfer',
        sourceId: prepared.transferId,
        ...(prepared.customerReference
          ? { metadata: { customerReference: prepared.customerReference } }
          : {}),
      },
      session,
    );

    return {
      transactionId: transaction.id,
      status: 'completed',
      ledgerStatus: 'posted',
      estimatedArrival: prepared.now,
      railReference: null,
      detail: null,
    };
  }
}
