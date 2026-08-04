import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { z } from 'zod';

import { NotFoundError } from '../../../common/errors/index.js';
import { newId, newReference } from '../../../infrastructure/database/identifier.js';
import { ClockService } from '../../../simulation/clock/clock.service.js';
import type { AccessTokenClaims } from '../../auth/application/token.service.js';
import { CustomerDoc } from '../../customers/infrastructure/customer.schemas.js';
import { customerDisplayName } from '../../kyc/infrastructure/customer-profile.js';
import { CallbackAlreadyHandledError } from '../domain/support-errors.js';
import { toCallbackView } from '../infrastructure/support.mapper.js';
import type {
  callbackRequestSchema,
  CallbackView,
  staffCallbackQuerySchema,
} from '../infrastructure/support-requests.js';
import { SupportCallbackDoc } from '../infrastructure/support.schemas.js';
import { CALLBACK_LIST_LIMIT, CALLBACK_REFERENCE_PREFIX } from '../support.constants.js';

export type CallbackInput = z.infer<typeof callbackRequestSchema>;
export type StaffCallbackQuery = z.infer<typeof staffCallbackQuerySchema>;

type CallbackOutcome = 'completed' | 'cancelled';

/**
 * Callback requests — the customer asks for a phone call instead of typing in a thread.
 * A request moves through `pending → completed | cancelled` exactly once; the atomic filter on
 * `handle` makes a double-handled callback impossible rather than merely unlikely.
 */
@Injectable()
export class CallbackService {
  constructor(
    @InjectModel(SupportCallbackDoc.name) private readonly callbacks: Model<SupportCallbackDoc>,
    @InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>,
    private readonly clock: ClockService,
  ) {}

  async request(customerId: string, input: CallbackInput): Promise<CallbackView> {
    const customer = await this.customers.findById(customerId).lean();
    if (!customer) {
      throw new NotFoundError('Customer', customerId);
    }

    const [created] = await this.callbacks.create([
      {
        _id: newId(),
        reference: newReference(CALLBACK_REFERENCE_PREFIX),
        customerId,
        customerName: customerDisplayName(customer),
        phone: input.phone,
        reason: input.reason,
        preferredWindow: input.preferredWindow,
        ticketId: input.ticketId ?? null,
        status: 'pending',
        requestedAt: this.clock.now(),
        handledBy: null,
        handledAt: null,
        notes: null,
      },
    ]);
    return toCallbackView(created as SupportCallbackDoc);
  }

  async listForCustomer(customerId: string): Promise<CallbackView[]> {
    const rows = await this.callbacks
      .find({ customerId })
      .sort({ requestedAt: -1 })
      .limit(CALLBACK_LIST_LIMIT)
      .lean();
    return rows.map(toCallbackView);
  }

  /** The staff work queue — oldest request first, like any phone queue. */
  async listForStaff(query: StaffCallbackQuery): Promise<CallbackView[]> {
    const filter = query.status ? { status: query.status } : {};
    const rows = await this.callbacks
      .find(filter)
      .sort({ requestedAt: 1 })
      .limit(CALLBACK_LIST_LIMIT)
      .lean();
    return rows.map(toCallbackView);
  }

  async complete(
    callbackId: string,
    staff: AccessTokenClaims,
    notes: string | null,
  ): Promise<CallbackView> {
    return this.handle(callbackId, staff.sub, 'completed', notes);
  }

  async cancel(callbackId: string, staff: AccessTokenClaims): Promise<CallbackView> {
    return this.handle(callbackId, staff.sub, 'cancelled', null);
  }

  private async handle(
    callbackId: string,
    staffId: string,
    outcome: CallbackOutcome,
    notes: string | null,
  ): Promise<CallbackView> {
    const updated = await this.callbacks
      .findOneAndUpdate(
        { _id: callbackId, status: 'pending' },
        { $set: { status: outcome, handledBy: staffId, handledAt: this.clock.now(), notes } },
        { new: true },
      )
      .lean();

    if (!updated) {
      const existing = await this.callbacks.findById(callbackId).lean();
      if (!existing) {
        throw new NotFoundError('Callback request', callbackId);
      }
      throw new CallbackAlreadyHandledError(callbackId);
    }
    return toCallbackView(updated);
  }
}
