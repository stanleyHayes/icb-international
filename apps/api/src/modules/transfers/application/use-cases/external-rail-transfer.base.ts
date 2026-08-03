import type { TransferRail } from '@icb/contracts';
import type { ClientSession } from 'mongoose';

import { glRef } from '../../../ledger/domain/account-ref.js';
import { GL_PENDING_SETTLEMENT } from '../../../ledger/domain/chart-of-accounts.js';
import { type LedgerService } from '../../../ledger/ledger.service.js';
import type { RailSubmission } from '../../../../simulation/rails/rail.types.js';
import { type FxConversionService } from '../../../fx/fx-conversion.service.js';
import { describeDestination } from '../../domain/recipient.js';
import type { RailDispatchPort } from '../rail-dispatch.port.js';
import type { PreparedTransfer, TransferExecution } from '../transfer-pipeline.types.js';
import { buildFeeLines, buildValueLines } from './posting-lines.js';
import type { RailTransferUseCase } from './rail-transfer.use-case.js';

/**
 * Shared behaviour of the outbound rails (ACH, wire, SWIFT).
 *
 * An outbound transfer parks its value in pending settlement (2100): the money has left the
 * customer but has not reached anyone — which is exactly what "in flight" means on a statement.
 * The rail adapter answers when it lands; the end-of-day batch clears 2100 against cash when
 * that instant passes. The only per-rail variation is the network itself, so the concrete
 * classes are one line each.
 */
export abstract class ExternalRailTransferUseCase implements RailTransferUseCase {
  abstract readonly rail: TransferRail;

  constructor(
    private readonly ledger: LedgerService,
    private readonly fxConversion: FxConversionService,
    private readonly rails: RailDispatchPort,
  ) {}

  async execute(prepared: PreparedTransfer, session: ClientSession): Promise<TransferExecution> {
    // Dispatch first: a rail rejection aborts before anything is written, inside the caller's
    // transaction, so a refused instruction never leaves a posting behind.
    const dispatched = await this.rails.dispatch(this.rail, this.submissionFor(prepared));

    const narrative = `Transfer to ${prepared.recipientName}`;
    const lines = [
      ...buildValueLines(prepared, glRef(GL_PENDING_SETTLEMENT), this.fxConversion, narrative),
      ...buildFeeLines(prepared, narrative),
    ];

    const transaction = await this.ledger.postWithin(
      {
        type: 'transfer_out',
        description: narrative,
        actor: { kind: 'customer', id: prepared.customerId, label: prepared.source.number },
        lines,
        reference: prepared.reference,
        status: 'authorised',
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
      status: 'in_settlement',
      ledgerStatus: 'authorised',
      estimatedArrival: dispatched.settlesAt,
      railReference: dispatched.railReference,
      detail: `Accepted by ${this.rail.toUpperCase()} as ${dispatched.railReference}`,
    };
  }

  /** The instruction as the rail would carry it. */
  private submissionFor(prepared: PreparedTransfer): RailSubmission {
    return {
      sourceId: prepared.transferId,
      amount: prepared.credit,
      debtorAccount: prepared.source.number,
      debtorName: prepared.source.nickname ?? prepared.source.productName,
      creditorName: prepared.recipientName,
      creditorAccount: describeDestination(prepared.destination),
      narrative: prepared.customerReference ?? prepared.reference,
    };
  }
}
