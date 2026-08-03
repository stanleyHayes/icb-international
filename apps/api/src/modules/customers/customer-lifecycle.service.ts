import type { CustomerAdminView, CustomerStatus, KycStatus } from '@icb/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import type { Model } from 'mongoose';

import { ConflictError } from '../../common/errors/index.js';
import { redactPii } from '../../common/interceptors/redact.js';
import { ClockService } from '../../simulation/clock/clock.service.js';
import { assertTransitionAllowed } from './domain/customer-status.js';
import { AdminViewAssembler } from './infrastructure/admin-view.assembler.js';
import { CustomerDoc } from './infrastructure/customer.schemas.js';
import { CustomersService } from './customers.service.js';
import type { SetCustomerStatusRequest } from './customers.types.js';

/** Who caused a transition — a staff member, or the simulation clock for dormancy sweeps. */
export interface TransitionActor {
  readonly id: string;
  readonly label: string;
}

/**
 * Lifecycle transitions.
 *
 * The only writer of `customers.status` anywhere in the system. Every transition goes through
 * the state machine, is recorded in the document's append-only `statusHistory`, and is applied
 * with the previous status in the filter — so two staff members acting on the same customer at
 * the same instant cannot both "win" and leave the history disagreeing with the outcome.
 */
@Injectable()
export class CustomerLifecycleService {
  private readonly logger = new Logger(CustomerLifecycleService.name);

  constructor(
    @InjectModel(CustomerDoc.name) private readonly customers: Model<CustomerDoc>,
    private readonly profiles: CustomersService,
    private readonly assembler: AdminViewAssembler,
    private readonly clock: ClockService,
  ) {}

  async setStatus(
    customerId: string,
    request: SetCustomerStatusRequest,
    actor: TransitionActor,
  ): Promise<CustomerAdminView> {
    const customer = await this.profiles.require(customerId);
    const from = customer.status as CustomerStatus;

    assertTransitionAllowed({ from, to: request.status, kycStatus: customer.kycStatus as KycStatus });

    const updated = await this.customers
      .findOneAndUpdate(
        { _id: customerId, status: from },
        {
          $set: { status: request.status },
          $push: {
            statusHistory: {
              from,
              to: request.status,
              reason: request.reason,
              changedBy: actor.label,
              changedAt: this.clock.now(),
            },
          },
        },
        { new: true },
      )
      .lean();

    if (!updated) {
      throw new ConflictError('The customer status changed while this request was processed', {
        customerId,
      });
    }

    this.logger.log(
      redactPii({ customerId, from, to: request.status, actor: actor.id, reason: request.reason }),
      'Customer status changed',
    );
    return this.assembler.assemble(updated);
  }
}
