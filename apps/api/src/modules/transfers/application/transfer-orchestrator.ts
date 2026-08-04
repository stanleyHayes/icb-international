import type { CreateTransferRequest, TransferRail } from '@icb/contracts';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { DomainError, NotFoundError } from '../../../common/errors/index.js';
import { MetricsService } from '../../../common/observability/metrics.service.js';
import { TransactionManager } from '../../../infrastructure/database/transaction.manager.js';
import { OutboxService } from '../../../infrastructure/outbox/outbox.service.js';
import { customerRef } from '../../ledger/domain/account-ref.js';
import { balanceKey } from '../../ledger/domain/balance-key.js';
import { buildTransferDocument, type ScheduleInput } from '../infrastructure/transfer.factory.js';
import { TransferDoc } from '../infrastructure/transfer.schemas.js';
import { TRANSFER_EVENTS } from '../domain/transfers.constants.js';
import { StandingOrdersService } from './standing-orders.service.js';
import { TransferPreparationService } from './transfer-preparation.service.js';
import type { StepUpProof } from './transfer-step-up.service.js';
import type { PreparedTransfer, TransferExecution } from './transfer-pipeline.types.js';
import { RAIL_USE_CASES, type RailTransferUseCase } from './use-cases/rail-transfer.use-case.js';

/**
 * The transfer pipeline's execution half.
 *
 * Preparation (steps 1–9) lives in `TransferPreparationService`; this runs what remains — the
 * rail use-case (hold/post/schedule settlement), the record, and the notification — inside one
 * database transaction, so a transfer and its posting and its event commit or roll back
 * together. Scheduled sends record now and wake later via the outbox.
 */
@Injectable()
export class TransferOrchestrator {
  private readonly logger = new Logger(TransferOrchestrator.name);

  // eslint-disable-next-line max-params -- every collaborator is load-bearing; a bag of unrelated infrastructure would satisfy the count and hurt the reading.
  constructor(
    @InjectModel(TransferDoc.name) private readonly transfers: Model<TransferDoc>,
    private readonly preparation: TransferPreparationService,
    @Inject(RAIL_USE_CASES) private readonly useCases: readonly RailTransferUseCase[],
    private readonly standingOrders: StandingOrdersService,
    private readonly transactionManager: TransactionManager,
    private readonly outbox: OutboxService,
    private readonly metrics: MetricsService,
  ) {}

  /** Run the full pipeline for a customer-initiated send. */
  async initiate(
    customerId: string,
    request: CreateTransferRequest,
    proof?: StepUpProof,
  ): Promise<TransferDoc> {
    const prepared = await this.preparation.prepare(customerId, request, proof);
    if (request.schedule) {
      return this.recordScheduled(prepared, request.schedule);
    }
    const doc = await this.executeNow(prepared);
    await this.saveBeneficiaryIfAsked(customerId, request, prepared);
    return doc;
  }

  /** Steps 8–10 for an immediate send: funds, use-case, record, notify — one unit of work. */
  private async executeNow(prepared: PreparedTransfer): Promise<TransferDoc> {
    const lockKeys = await this.contendedKeys(prepared);

    const doc = await this.transactionManager.withTransaction(
      async (session) => {
        // Checked while holding the account's lock, not before taking it. Outside the lock this
        // is a time-of-check/time-of-use hole: two sends from one account read the same available
        // balance, both find it sufficient, and both post — overdrawing an account that had the
        // money for exactly one of them.
        await this.preparation.assertFunds(prepared);

        const execution = await this.executePrepared(prepared, session);
        const doc = await this.record(prepared, execution, session);
        await this.publishSent(prepared, session);
        return doc;
      },
      { lockKeys },
    );

    // After the commit, deliberately: an aborted-and-retried transaction must not count twice.
    this.metrics.transferOutcome(prepared.rail, doc.status);
    return doc;
  }

  /**
   * The customer balances this transfer will write, named before the transaction opens.
   *
   * The sender is always one of them; the rail adds the recipient when the money stays inside
   * ICB. Declaring them lets concurrent transfers on one account queue rather than collide —
   * two sends from the same account at the same instant is an ordinary thing for a customer to
   * do, and neither of them may be lost.
   */
  async contendedKeys(prepared: PreparedTransfer): Promise<string[]> {
    const useCase = this.useCaseFor(prepared.rail);
    const fromRail = (await useCase.contendedKeys?.(prepared)) ?? [];

    return [
      balanceKey(customerRef(prepared.source._id), prepared.debit.currency),
      ...fromRail,
    ];
  }

  /** The rail use-case's turn: hold, post, schedule settlement. */
  async executePrepared(
    prepared: PreparedTransfer,
    session: ClientSession,
  ): Promise<TransferExecution> {
    return this.useCaseFor(prepared.rail).execute(prepared, session);
  }

  useCaseFor(rail: TransferRail): RailTransferUseCase {
    const useCase = this.useCases.find((candidate) => candidate.rail === rail);
    if (!useCase) {
      throw new NotFoundError('Transfer rail', rail);
    }
    return useCase;
  }

  /** A standing-order run spawns its next occurrence — delegated to the series owner. */
  async advanceSeries(
    executed: TransferDoc,
    session: ClientSession,
  ): Promise<{ transferId: string; executeAt: Date } | null> {
    return this.standingOrders.advance(executed, session);
  }

  /** Persist the transfer document inside the execution's transaction. */
  private async record(
    prepared: PreparedTransfer,
    execution: TransferExecution,
    session: ClientSession,
  ): Promise<TransferDoc> {
    const immediate: ScheduleInput = {
      executeAt: prepared.now,
      schedule: null,
      standingOrderId: null,
      nextOccurrenceAt: null,
    };
    const [created] = await this.transfers.create(
      [{
        ...buildTransferDocument(prepared, { status: execution.status, detail: execution.detail }, immediate),
        transactionId: execution.transactionId,
        railReference: execution.railReference,
        estimatedArrival: execution.estimatedArrival,
        completedAt: execution.status === 'completed' ? prepared.now : null,
      }],
      { session, ordered: true },
    );
    if (!created) {
      throw new DomainError('INTERNAL_ERROR', 'The transfer could not be recorded');
    }
    this.logger.log({ transferId: prepared.transferId, rail: prepared.rail }, 'Transfer executed');
    return created;
  }

  /** A scheduled send: record now, run later — the wake-up rides the outbox. */
  private async recordScheduled(
    prepared: PreparedTransfer,
    schedule: NonNullable<CreateTransferRequest['schedule']>,
  ): Promise<TransferDoc> {
    return this.transactionManager.withTransaction(async (session) => {
      const plan = await this.standingOrders.plan(this.orderTerms(prepared), schedule, session);
      const [created] = await this.transfers.create(
        [{
          ...buildTransferDocument(prepared, { status: 'scheduled', detail: null }, plan),
          estimatedArrival: plan.executeAt,
        }],
        { session, ordered: true },
      );
      if (!created) {
        throw new DomainError('INTERNAL_ERROR', 'The transfer could not be scheduled');
      }
      await this.outbox.publish(
        { type: TRANSFER_EVENTS.due, payload: { transferId: prepared.transferId }, availableAt: plan.executeAt },
        session,
      );
      this.logger.log({ transferId: prepared.transferId }, 'Transfer scheduled');
      return created;
    });
  }

  /** The notification half of the transactional outbox. */
  async publishSent(prepared: PreparedTransfer, session: ClientSession): Promise<void> {
    await this.outbox.publish(
      {
        type: TRANSFER_EVENTS.sent,
        payload: {
          customerId: prepared.customerId,
          transferId: prepared.transferId,
          reference: prepared.reference,
          rail: prepared.rail,
          debitMinorUnits: prepared.debit.minorUnits,
          currency: prepared.debit.currency,
          recipientName: prepared.recipientName,
        },
      },
      session,
    );
  }

  private orderTerms(prepared: PreparedTransfer) {
    return {
      customerId: prepared.customerId,
      fromAccountId: prepared.source._id,
      destination: prepared.destination,
      amountMinorUnits: prepared.debit.minorUnits,
      currency: prepared.debit.currency as string,
      reference: prepared.customerReference,
      note: prepared.note,
      name: prepared.customerReference ?? `To ${prepared.recipientName}`,
    };
  }

  /** `saveBeneficiary` is a convenience, never a reason to fail a completed transfer. */
  private async saveBeneficiaryIfAsked(
    customerId: string,
    request: CreateTransferRequest,
    prepared: PreparedTransfer,
  ): Promise<void> {
    if (!request.saveBeneficiary) {
      return;
    }
    await this.preparation.savePayee(
      customerId,
      prepared.destination,
      prepared.recipientName || request.beneficiaryNickname || 'Saved payee',
      request.beneficiaryNickname,
    );
  }
}
