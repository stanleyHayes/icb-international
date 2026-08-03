import type { Hold } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { customerRef } from '../../ledger/domain/account-ref.js';
import { HoldDoc } from '../../ledger/infrastructure/ledger.schemas.js';
import { toHoldDto } from '../infrastructure/hold.mapper.js';

/**
 * Read side of authorisation holds for an account.
 *
 * Holds are written exclusively by the ledger's HoldService; this only ever reads, and only
 * ever the ones still reserving value.
 */
@Injectable()
export class AccountHoldsService {
  constructor(
    @InjectModel(HoldDoc.name) private readonly holds: Model<HoldDoc>,
  ) {}

  /** Outstanding (unreleased) holds, newest first. */
  async holdsFor(accountId: string): Promise<Hold[]> {
    const rows = await this.holds
      .find({ accountRef: customerRef(accountId), releasedAt: null })
      .sort({ placedAt: -1 })
      .lean();
    return rows.map(toHoldDto);
  }
}
