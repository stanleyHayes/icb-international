import type { CustomerNote } from '@icb/contracts';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError } from '../../common/errors/index.js';
import { newId } from '../../infrastructure/database/identifier.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { CustomersService } from './customers.service.js';
import type { CreateCustomerNoteRequest } from './customers.types.js';
import { CustomerNoteDoc } from './infrastructure/customer-note.schemas.js';
import { toCustomerNote } from './infrastructure/customer.mapper.js';

/** The staff member writing the note, taken from the verified token — never from the body. */
export interface NoteAuthor {
  readonly id: string;
  readonly name: string;
}

/**
 * Staff notes on a customer.
 *
 * Notes are the institutional memory of a relationship — why a limit was raised, what a caller
 * was told — so they are append-only (no edit, no delete) and attributed to the authenticated
 * staff member. Pinned notes surface first; everything else is newest-first.
 */
@Injectable()
export class CustomerNotesService {
  constructor(
    @InjectModel(CustomerNoteDoc.name) private readonly notes: Model<CustomerNoteDoc>,
    private readonly profiles: CustomersService,
    private readonly clock: ClockService,
  ) {}

  async list(customerId: string): Promise<CustomerNote[]> {
    await this.profiles.require(customerId);
    const rows = await this.notes
      .find({ customerId })
      .sort({ pinned: -1, createdAt: -1, _id: -1 })
      .lean();
    return rows.map(toCustomerNote);
  }

  async create(
    customerId: string,
    request: CreateCustomerNoteRequest,
    author: NoteAuthor,
  ): Promise<CustomerNote> {
    await this.profiles.require(customerId);

    const [created] = await this.notes.create([
      {
        _id: newId(),
        customerId,
        body: request.body,
        pinned: request.pinned,
        authorId: author.id,
        authorName: author.name,
        createdAt: this.clock.now(),
      },
    ]);
    if (!created) {
      throw new ConflictError('The note could not be saved', { customerId });
    }
    return toCustomerNote(created);
  }
}
