import type { StandingOrder, TransferSchedule } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { ClientSession, Model } from 'mongoose';

import { NotFoundError } from '../../../common/errors/index.js';
import { newId, newReference } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import { toMoneyDto } from '../../accounts/infrastructure/account.mapper.js';
import { nextOccurrence, parseRRule } from '../domain/rrule.js';
import { InvalidScheduleError } from '../domain/transfer-errors.js';
import { scheduledExecutionInstant } from '../domain/cut-offs.js';
import { SCHEDULED_EXECUTION_HOUR_UTC } from '../domain/transfers.constants.js';
import {
  STANDING_ORDER_STATUSES,
  StandingOrderDoc,
} from '../infrastructure/standing-order.schemas.js';
import { timelineEntry, buildNextOccurrenceDocument, type ScheduleInput } from '../infrastructure/transfer.factory.js';
import { TransferDoc } from '../infrastructure/transfer.schemas.js';

export interface StandingOrderTerms {
  readonly customerId: string;
  readonly fromAccountId: string;
  readonly destination: Record<string, unknown>;
  readonly amountMinorUnits: number;
  readonly currency: string;
  readonly reference: string | null;
  readonly note: string | null;
  readonly name: string;
}

/**
 * Recurring transfers.
 *
 * The standing order holds the terms and the rule; each run materialises as its own transfer
 * document, so a failed run is a failed transfer and never a corrupted series. Occurrence
 * arithmetic lives in `domain/rrule.ts` — this service is only the persistence of the plan.
 */
@Injectable()
export class StandingOrdersService {
  constructor(
    @InjectModel(StandingOrderDoc.name) private readonly orders: Model<StandingOrderDoc>,
    @InjectModel(TransferDoc.name) private readonly transfers: Model<TransferDoc>,
    private readonly clock: ClockService,
  ) {}

  /**
   * Work out when a scheduled request first runs. A one-off future date needs no standing
   * order; an RRULE creates one and returns the first two occurrences of the series.
   */
  async plan(
    terms: StandingOrderTerms,
    schedule: TransferSchedule,
    session?: ClientSession,
  ): Promise<ScheduleInput & { standingOrderId: string | null }> {
    // Destructured so the presence check narrows the value, then reattached: TypeScript will
    // narrow `rrule` on its own but not the surrounding object into the intersection type.
    const { rrule } = schedule;

    if (!rrule) {
      return {
        executeAt: scheduledExecutionInstant(schedule.startsOn, SCHEDULED_EXECUTION_HOUR_UTC),
        schedule: embedSchedule(schedule),
        standingOrderId: null,
        nextOccurrenceAt: null,
      };
    }
    return this.planRecurring(terms, { ...schedule, rrule }, session);
  }

  /** An RRULE series: create the standing order and return its first two occurrences. */
  private async planRecurring(
    terms: StandingOrderTerms,
    schedule: TransferSchedule & { rrule: string },
    session?: ClientSession,
  ): Promise<ScheduleInput & { standingOrderId: string }> {
    const rule = parseRRule(schedule.rrule);
    const first = nextOccurrence(rule, schedule, this.clock.now());
    if (first === null) {
      throw new InvalidScheduleError('the series has no future occurrences');
    }
    const second = nextOccurrence(rule, schedule, first);

    const standingOrderId = newId();
    await this.orders.create(
      [{
        _id: standingOrderId,
        customerId: terms.customerId,
        name: terms.name,
        fromAccountId: terms.fromAccountId,
        destination: terms.destination,
        amountMinorUnits: terms.amountMinorUnits,
        currency: terms.currency,
        reference: terms.reference,
        note: terms.note,
        schedule: embedSchedule(schedule),
        nextRunAt: withExecutionHour(second),
        status: STANDING_ORDER_STATUSES[0],
        executedCount: 0,
        createdAt: this.clock.now(),
      }],
      session ? { session, ordered: true } : { ordered: true },
    );

    return {
      executeAt: withExecutionHour(first) as Date,
      schedule: embedSchedule(schedule),
      standingOrderId,
      nextOccurrenceAt: withExecutionHour(second),
    };
  }

  async list(customerId: string): Promise<StandingOrder[]> {
    const rows = await this.orders.find({ customerId }).sort({ createdAt: -1 }).lean();
    return rows.map((row) => this.toContract(row));
  }

  /** Cancel the series and every future-dated transfer it has already materialised. */
  async cancel(customerId: string, standingOrderId: string): Promise<StandingOrder> {
    const updated = await this.orders.findOneAndUpdate(
      { _id: standingOrderId, customerId, status: STANDING_ORDER_STATUSES[0] },
      { $set: { status: 'cancelled', nextRunAt: null } },
      { new: true },
    ).lean();
    if (!updated) {
      throw new NotFoundError('Standing order', standingOrderId);
    }

    await this.transfers.updateMany(
      { standingOrderId, customerId, status: 'scheduled' },
      {
        $set: { status: 'cancelled' },
        $push: { timeline: timelineEntry(this.clock.now(), 'cancelled', 'Series cancelled') },
      },
    );
    return this.toContract(updated);
  }

  /**
   * After a run executes: count it, and materialise the next occurrence as its own scheduled
   * transfer — or close the series when the rule has run out. Returns the new transfer so the
   * caller can schedule its wake-up event.
   */
  async advance(
    executed: TransferDoc,
    session: ClientSession,
  ): Promise<{ transferId: string; executeAt: Date } | null> {
    if (!executed.standingOrderId || !executed.schedule?.rrule) {
      return null;
    }
    const order = await this.orders.findById(executed.standingOrderId).lean();
    if (!order || order.status !== STANDING_ORDER_STATUSES[0]) {
      return null;
    }

    const rule = parseRRule(order.schedule.rrule ?? '');
    const schedule = contractSchedule(order.schedule);
    const next = nextOccurrence(rule, schedule, this.clock.now());
    const nextRunAt = withExecutionHour(next);

    await this.orders.updateOne(
      { _id: order._id },
      {
        $inc: { executedCount: 1 },
        $set: {
          nextRunAt,
          ...(next === null ? { status: 'completed' } : {}),
        },
      },
      { session },
    );

    if (nextRunAt === null) {
      return null;
    }
    const transferId = await this.materialiseNext(executed, order, schedule, nextRunAt, session);
    return { transferId, executeAt: nextRunAt };
  }

  /** The next run as its own transfer document — same terms, new identity, fresh timeline. */
  private async materialiseNext(
    executed: TransferDoc,
    order: StandingOrderDoc,
    schedule: TransferSchedule,
    nextRunAt: Date,
    session: ClientSession,
  ): Promise<string> {
    const transferId = newId();
    await this.transfers.create(
      [buildNextOccurrenceDocument({
        executed,
        standingOrderId: order._id,
        orderName: order.name,
        schedule: embedSchedule(schedule),
        nextRunAt,
        transferId,
        reference: newReference('TRF'),
        now: this.clock.now(),
      })],
      { session, ordered: true },
    );
    return transferId;
  }

  private toContract(row: StandingOrderDoc): StandingOrder {
    return {
      id: row._id,
      name: row.name,
      fromAccountId: row.fromAccountId,
      destination: row.destination as StandingOrder['destination'],
      amount: toMoneyDto(row.amountMinorUnits, row.currency),
      currency: row.currency as StandingOrder['currency'],
      schedule: contractSchedule(row.schedule),
      nextRunAt: row.nextRunAt?.toISOString() ?? null,
      status: row.status,
      executedCount: row.executedCount,
      createdAt: row.createdAt.toISOString(),
    };
  }
}

function embedSchedule(schedule: TransferSchedule): {
  rrule: string | null;
  startsOn: string;
  endsOn: string | null;
  maxOccurrences: number | null;
} {
  return {
    rrule: schedule.rrule ?? null,
    startsOn: schedule.startsOn,
    endsOn: schedule.endsOn ?? null,
    maxOccurrences: schedule.maxOccurrences ?? null,
  };
}

function contractSchedule(schedule: StandingOrderDoc['schedule']): TransferSchedule {
  return {
    ...(schedule.rrule ? { rrule: schedule.rrule } : {}),
    startsOn: schedule.startsOn,
    ...(schedule.endsOn ? { endsOn: schedule.endsOn } : {}),
    ...(schedule.maxOccurrences !== null ? { maxOccurrences: schedule.maxOccurrences } : {}),
  };
}

/** An occurrence is a midnight instant; the run itself happens at the execution hour. */
function withExecutionHour(occurrence: Date | null): Date | null {
  if (occurrence === null) {
    return null;
  }
  return scheduledExecutionInstant(occurrence.toISOString().slice(0, 10), SCHEDULED_EXECUTION_HOUR_UTC);
}
