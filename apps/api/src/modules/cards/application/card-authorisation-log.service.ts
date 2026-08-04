import { cursorQuerySchema, type CardAuthorisation, type CursorPage } from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ClockService } from '../../../simulation/clock/clock.service.js';
import { CardAuthorisationDoc } from '../infrastructure/card-authorisation.schemas.js';
import { toCardAuthorisation } from '../infrastructure/card.mapper.js';
import { CardReader } from './card-reader.js';

export type AuthorisationQuery = ReturnType<typeof cursorQuerySchema.parse>;

/**
 * Reading the authorisation log, and ageing it out.
 *
 * Expiry is deliberately split in two. `HoldService.expireDue` gives the customer their available
 * balance back the moment the seven-day window closes — that is the part they feel, and it must
 * not wait for anything card-specific to run. This sweep then marks the matching authorisations
 * `expired` so the history explains why the hold vanished. Neither half can corrupt the other if
 * it runs twice or runs late.
 */
@Injectable()
export class CardAuthorisationLogService {
  private readonly logger = new Logger(CardAuthorisationLogService.name);

  constructor(
    @InjectModel(CardAuthorisationDoc.name)
    private readonly authorisations: Model<CardAuthorisationDoc>,
    private readonly reader: CardReader,
    private readonly clock: ClockService,
  ) {}

  async listForCard(
    cardId: string,
    customerId: string,
    query: AuthorisationQuery,
  ): Promise<CursorPage<CardAuthorisation>> {
    // Ownership is proved against the card before a single authorisation row is read.
    await this.reader.loadOwned(cardId, customerId);
    return this.list(cardId, query);
  }

  /** The staff console's history: the card must exist, but no ownership scope applies. */
  async listForCardAsStaff(
    cardId: string,
    query: AuthorisationQuery,
  ): Promise<CursorPage<CardAuthorisation>> {
    await this.reader.loadById(cardId);
    return this.list(cardId, query);
  }

  private async list(
    cardId: string,
    query: AuthorisationQuery,
  ): Promise<CursorPage<CardAuthorisation>> {
    const filter: Record<string, unknown> = { cardId };
    if (query.cursor) {
      filter['_id'] = { $lt: query.cursor };
    }

    const rows = await this.authorisations
      .find(filter)
      .sort({ _id: -1 })
      .limit(query.limit + 1)
      .lean();

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;

    return {
      items: page.map(toCardAuthorisation),
      nextCursor: hasMore ? (page[page.length - 1]?._id ?? null) : null,
      hasMore,
    };
  }

  /**
   * Mark every authorisation whose window has closed without a capture. Idempotent: the filter
   * only matches rows still sitting in `approved`, so running the sweep twice changes nothing.
   */
  async expireDue(): Promise<number> {
    const result = await this.authorisations.updateMany(
      { status: 'approved', expiresAt: { $lte: this.clock.now() } },
      { $set: { status: 'expired' } },
    );

    if (result.modifiedCount > 0) {
      this.logger.log({ count: result.modifiedCount }, 'Expired card authorisations');
    }
    return result.modifiedCount;
  }
}
