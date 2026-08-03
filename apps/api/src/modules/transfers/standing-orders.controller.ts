import type { StandingOrder } from '@icb/contracts';
import { Controller, Get, Param, Post } from '@nestjs/common';

import { CurrentCustomer } from '../../common/decorators/current-user.decorator.js';
import { StandingOrdersService } from './application/standing-orders.service.js';

/** Recurring transfers: the series itself, not its individual runs. */
@Controller('standing-orders')
export class StandingOrdersController {
  constructor(private readonly standingOrders: StandingOrdersService) {}

  @Get()
  async list(@CurrentCustomer() customerId: string): Promise<StandingOrder[]> {
    return this.standingOrders.list(customerId);
  }

  @Post(':standingOrderId/cancel')
  async cancel(
    @CurrentCustomer() customerId: string,
    @Param('standingOrderId') standingOrderId: string,
  ): Promise<StandingOrder> {
    return this.standingOrders.cancel(customerId, standingOrderId);
  }
}
